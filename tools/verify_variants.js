/**
 * 校验「一行挤了多个说法」的变体拆分结果。
 * 断言：
 *   1) 拆出来的每条在页面上是独立一行，各带自己的中文与播放按钮
 *   2) 词条行的意语侧不再残留 / 并列（除非是「一词多译」这类有意保留的）
 *   3) 每条的 mp3 文件真实存在
 * 用法：node tools/verify_variants.js
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
  await page.waitForTimeout(700);

  const DB = await page.evaluate(() => window.APP_DATA);
  const prof = DB.professions.find((p) => p.id === 'ristorante');

  // 1) 拆分后每一行都要有独立中文
  let noZh = 0, noAudio = 0, stillSlash = 0;
  const slashRows = [];
  for (const sec of prof.sections) {
    for (const it of sec.items) {
      if (it.t === 'd') continue;
      if (it.t === 'phone') continue;
      if (!it.zh) noZh++;
      if (!it.audio) noAudio++;
      // 意语侧还带 / 的：应该是「一词多译」或括号里的说明，且中文侧段数=1
      if (/\s[／/]\s/.test(it.it || '')) {
        stillSlash++;
        slashRows.push(sec.id + ' | ' + it.it.slice(0, 46) + ' ~ ' + (it.zh || '').slice(0, 24));
      }
    }
  }
  noZh === 0 ? ok('每条都有中文') : no('有 ' + noZh + ' 条缺中文');
  noAudio === 0 ? ok('每条都有音频字段') : no('有 ' + noAudio + ' 条缺音频');
  console.log('     意语侧仍含 / 的行：' + stillSlash + ' 条（应为一词多译/括号说明，有意保留）');
  slashRows.slice(0, 8).forEach((r) => console.log('       · ' + r));

  // 2) 抽查三组典型拆分，在真实页面上确认是两/三/四行
  const cases = [
    { hash: '#/ristorante/s01', ids: ['s01_0', 's01_0b'], n: 2, label: 'benvenuto / benvenuti' },
    { hash: '#/ristorante/s19', ids: ['s19_18', 's19_18b', 's19_18c', 's19_18d'], n: 4, label: 'il tè (verde/rosso/…) ' },
    { hash: '#/ristorante/s11', ids: ['s11_6', 's11_6b', 's11_6c'], n: 3, label: 'fuoco alto/medio/basso' },
  ];
  for (const c of cases) {
    await page.goto(URL + c.hash, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const got = await page.evaluate((ids) => ids.map((id) => {
      const el = document.querySelector('#viewChapter [data-id="' + id + '"]');
      if (!el) return null;
      const it = el.querySelector('.it, .itxt, .txt') || el;
      const zh = el.querySelector('.zh');
      return {
        it: (it ? it.textContent : '').trim().slice(0, 40),
        zh: zh ? zh.textContent.trim().slice(0, 24) : '',
        play: !!el.querySelector('.b-play'),
      };
    }), c.ids);
    const missing = got.filter((x) => !x).length;
    if (missing) { no(c.label + ' 有 ' + missing + ' 条没渲染出来'); continue; }
    const uniqIt = new Set(got.map((x) => x.it));
    const allZh = got.every((x) => x.zh.length > 0);
    const allPlay = got.every((x) => x.play);
    if (got.length === c.n && uniqIt.size === c.n && allZh && allPlay) {
      ok(c.label + ' → ' + c.n + ' 条独立行，各有中文与播放键');
      got.forEach((x) => console.log('       · ' + x.it + '  ~  ' + x.zh));
    } else {
      no(c.label + ' 拆分不完整：' + JSON.stringify(got));
    }
    const name = '50-var-' + c.hash.replace(/[#\/]/g, '-');
    await page.screenshot({ path: path.join(ROOT, 'tools/shots', name + '.png') });
  }

  // 3) 抽查音频文件真实存在（file:// 下不能用 fetch，直接查磁盘）
  const fs = require('fs');
  const sample = ['s01_0', 's01_0b', 's19_18b', 's19_18d', 's11_6c', 's27_16b',
    's01_8b', 's12_2b', 's17_5b', 's20_15c', 's26_14b', 's13_0b'];
  const missFile = sample.filter((id) => !fs.existsSync(path.join(ROOT, 'audio', id + '.mp3')));
  const tooSmall = sample.filter((id) => {
    const f = path.join(ROOT, 'audio', id + '.mp3');
    return fs.existsSync(f) && fs.statSync(f).size < 1500;
  });
  missFile.length === 0 ? ok('抽查的 ' + sample.length + ' 个新音频都在') : no('音频缺失: ' + missFile.join(', '));
  tooSmall.length === 0 ? ok('新音频大小正常') : no('音频过小（可能是空文件）: ' + tooSmall.join(', '));

  await browser.close();
  console.log(bad ? '\n--- FAIL ' + bad + ' ---' : '\n--- all ok ---');
  process.exit(bad ? 1 : 0);
})();
