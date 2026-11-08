/**
 * 校验中文配音 + 文字点读 + 连播双语 + 播放高亮：
 *   1) 章节页无 .b-play 按钮
 *   2) 点意语文字只播意（audio 不带 _zh）
 *   3) 点中文文字只播中（audio 带 _zh）
 *   4) 连播本章时，同一词条依次出现 意 + 中 两段音频
 *   5) 播放时当前朗读的 .txt 带 .cur 高亮
 * 用法：node tools/verify_audio_zh.js
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let bad = 0;
const ok = (m) => console.log('ok   ' + m);
const no = (m) => { bad++; console.log('FAIL ' + m); };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => no('[pageerror] ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 进第一章
  await page.click('#profGrid .pcard[data-p="ristorante"]');
  await page.waitForTimeout(700);
  // 点侧栏第一张目录卡进单章
  await page.click('#chapterNav .cnav[data-chap]:nth-of-type(1)');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(ROOT, 'tools/shots/70-text-click.png') });

  // 1) 无播放按钮
  const nPlay = await page.evaluate(() => document.querySelectorAll('.b-play').length);
  nPlay === 0 ? ok('页面无 .b-play 按钮') : no('仍存在 ' + nPlay + ' 个 .b-play 按钮');

  // 2) 文字可点：统计 .txt 且带 data-t
  const txtInfo = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('.row .txt, .dline .txt, .phone .txt, .ex .txt'));
    return { total: all.length, it: all.filter((e) => e.dataset.t === 'it').length, zh: all.filter((e) => e.dataset.t === 'zh').length };
  });
  console.log('   .txt 总数 ' + txtInfo.total + ' (it=' + txtInfo.it + ' zh=' + txtInfo.zh + ')');
  txtInfo.total > 0 && txtInfo.it > 0 && txtInfo.zh > 0 ? ok('意/中文字都已标记为可点') : no('可点文字统计异常');

  // 无侵入记录：监听 play 事件，从 currentSrc 取文件名（不破坏真实播放）
  await page.evaluate(() => {
    window.__played = [];
    const a = window.IT.audioEl;
    a.addEventListener('play', () => {
      const src = a.currentSrc || a.src || '';
      window.__played.push(src.split('/').pop());
    });
  });

  // 3) 点一条「意语」文字 -> 只播意语音频（不带 _zh）
  const itSel = '.row .it.txt[data-t="it"], .dline .it.txt[data-t="it"], .ex .eit.txt[data-t="it"], .phone .num.txt[data-t="it"]';
  await page.click(itSel);
  await page.waitForTimeout(500);
  const afterIt = await page.evaluate(() => window.__played.slice());
  const itOk = afterIt.length === 1 && !/_zh\.mp3$/.test(afterIt[0]);
  itOk ? ok('点意语文字只播意语音频：' + afterIt[0]) : no('点意语结果异常：' + JSON.stringify(afterIt));
  // 高亮检查
  const curIt = await page.evaluate(() => {
    const c = document.querySelector('.txt.cur'); return c ? c.dataset.t : null;
  });
  curIt === 'it' ? ok('朗读意语时 .it 文字高亮') : no('意语高亮异常：' + curIt);

  // 4) 点一条「中文」文字 -> 只播中文音频（带 _zh）
  await page.evaluate(() => (window.__played = []));
  const zhSel = '.row .zh.txt[data-t="zh"], .dline .zh.txt[data-t="zh"], .ex .ezh.txt[data-t="zh"], .phone .use.txt[data-t="zh"]';
  await page.click(zhSel);
  await page.waitForTimeout(500);
  const afterZh = await page.evaluate(() => window.__played.slice());
  const zhOk = afterZh.length === 1 && /_zh\.mp3$/.test(afterZh[0]);
  zhOk ? ok('点中文文字只播中文音频：' + afterZh[0]) : no('点中文结果异常：' + JSON.stringify(afterZh));
  const curZh = await page.evaluate(() => {
    const c = document.querySelector('.txt.cur'); return c ? c.dataset.t : null;
  });
  curZh === 'zh' ? ok('朗读中文时 .zh 文字高亮') : no('中文高亮异常：' + curZh);

  // 5) 连播本章：每条应依次出现 意 + 中（检查顺序上「意在前后于同一词的中」）
  await page.evaluate(() => { window.__played = []; window.IT.player.stop(); });
  await page.click('.chap-tools [data-playsec]');
  await page.waitForTimeout(500);
  // 连播会自动翻章并跨很多音频，这里只验证：连播序列里 _zh 与对应的非_zh 交替出现
  await page.waitForTimeout(6000);
  const seq = await page.evaluate(() => window.__played.slice());
  const zhCount = seq.filter((x) => /_zh\.mp3$/.test(x)).length;
  const itCount = seq.filter((x) => !/_zh\.mp3$/.test(x)).length;
  console.log('   连播采样 ' + seq.length + ' 段（意 ' + itCount + ' / 中 ' + zhCount + '）');
  console.log('   序列: ' + JSON.stringify(seq));
  zhCount > 0 && itCount > 0 ? ok('连播同时包含意语与中文音频') : no('连播未同时包含双语');
  // 检查「意 → 中」逐条顺序：某条意语音频紧随其后是对应的中文 _zh
  let paired = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i], b = seq[i + 1];
    if (!/_zh\.mp3$/.test(a) && b === a.replace(/\.mp3$/, '_zh.mp3')) paired++;
  }
  paired > 0 ? ok('连播中每条约出现「意→中」顺序 ' + paired + ' 处') : no('未检测到 意→中 配对');

  // 关闭前先停掉播放器，避免音频仍在播放导致 browser.close 挂起
  await page.evaluate(() => { try { window.IT.player.stop(); const a = window.IT.audioEl; if (a) { a.pause(); a.removeAttribute('src'); a.load(); } } catch (e) {} });
  await page.waitForTimeout(200);

  // 媒体进程下 browser.close 偶发挂起，加超时兜底，确保脚本能干净退出
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]);
  console.log(bad ? '\n--- FAIL ' + bad + ' ---' : '\n--- all ok ---');
  process.exit(bad ? 1 : 0);
})();
