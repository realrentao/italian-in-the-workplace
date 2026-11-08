/* 校验：学习面板（卡片 / 选择题 / 填空题 / 情景模拟）的发音必须全部走 edge-tts mp3，
   不允许掉到浏览器 speechSynthesis 兜底（voice 不统一）。
   用法：node tools/verify_study_audio.js
   exit=0 全绿；exit=1 有兜底或音频文件缺失。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const fails = [];
const rows = [];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // 打桩：记录 playOne 的音频参数 + 判断是否真的在播（没被 enter() 的 stop 掐掉）
  await page.evaluate(() => {
    window.__calls = [];
    const P = window.IT.player;
    const orig = P.playOne.bind(P);
    P.playOne = (o) => { window.__calls.push({ audio: o.audio || '', text: o.text || '' }); return orig(o); };
  });

  const grab = async () => page.evaluate(() => {
    const c = window.__calls.slice();
    window.__calls = [];
    const el = window.IT.audioEl;
    return { calls: c, playing: window.IT.player.playing, src: (el && el.currentSrc) ? el.currentSrc.split('/').pop() : '' };
  });

  const check = (mod, res) => {
    res.calls.forEach((c) => {
      const ok = !!c.audio && fs.existsSync(path.join(ROOT, 'audio', c.audio));
      rows.push({ mod, audio: c.audio || '(空 → 浏览器TTS兜底)', text: c.text.slice(0, 34), ok });
      if (!ok) fails.push(mod + ' 掉到浏览器 TTS 或音频缺失: ' + (c.audio || '(空)') + ' | ' + c.text.slice(0, 30));
    });
    if (!res.calls.length) fails.push(mod + ' 没有任何播放调用');
  };

  /* --- 词汇卡片 --- */
  await page.evaluate(() => window.Study.open('cards'));
  await page.waitForTimeout(800);
  const cards = await grab();
  check('卡片·自动读音', cards);
  if (!cards.playing) fails.push('卡片自动读音被 stop() 掐掉了（playing=false）');
  await page.click('#cCtrl [data-play]');
  await page.waitForTimeout(350);
  check('卡片·听', await grab());

  /* --- 选择题 --- */
  await page.click('#studyTabs .tab[data-tab="quiz"]');
  await page.waitForTimeout(600);
  check('选择题·自动念题干/听发音', await grab());
  await page.click('#qPlay');
  await page.waitForTimeout(300);
  check('选择题·🔊', await grab());
  await page.click('#qOpts .opt');                    // 作答 → 念正确答句
  await page.waitForTimeout(400);
  check('选择题·答后念正确答句', await grab());
  const opts = await page.$$('#qOpts .opt');
  await opts[1].click();                              // 已作答 → 再点选项重听
  await page.waitForTimeout(300);
  const replay = await grab();
  rows.push({ mod: '选择题·点选项重听（中文选项无音属正常）', audio: replay.calls.map((c) => c.audio || '(中文项·静默)').join(','), text: '', ok: true });

  /* --- 填空题 --- */
  await page.click('#studyTabs .tab[data-tab="fill"]');
  await page.waitForTimeout(600);
  await page.click('#fillPlay');
  await page.waitForTimeout(300);
  check('填空题·听整句', await grab());
  await page.fill('#fillInput', 'xxx');
  await page.click('#fillOk');
  await page.waitForTimeout(400);
  check('填空题·提交后念答案词', await grab());

  /* --- 情景模拟 --- */
  await page.click('#studyTabs .tab[data-tab="sim"]');
  await page.waitForTimeout(700);
  check('情景模拟·自动念A台词', await grab());
  await page.click('#sPlay');
  await page.waitForTimeout(300);
  check('情景模拟·🔊 重听', await grab());
  await page.click('#sOpts .opt');
  await page.waitForTimeout(500);
  check('情景模拟·答后念正确答句', await grab());

  await page.screenshot({ path: path.join(__dirname, 'shots', '40-study-sim-audio.png') });

  console.log('模块 / 音频 / 文本');
  rows.forEach((r) => console.log('  ' + (r.ok ? 'ok  ' : 'FAIL') + '  ' + r.mod.padEnd(30) + '  ' + String(r.audio).padEnd(14) + '  ' + r.text));
  console.log('\n--- errors (' + fails.length + ') ---');
  fails.forEach((f) => console.log('  ' + f));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
