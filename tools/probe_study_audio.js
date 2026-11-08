/* 探针：检查学习面板各 tab 实际播放的音频是不是 edge-tts 的 mp3 */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // 打桩：记录每次 playOne 的 audio 与 text
  await page.evaluate(() => {
    window.__calls = [];
    const P = window.IT.player;
    const orig = P.playOne.bind(P);
    P.playOne = (o) => { window.__calls.push({ audio: o.audio || '', text: o.text || '' }); return orig(o); };
  });

  // 打开学习面板
  await page.evaluate(() => window.Study.open('cards'));
  await page.waitForTimeout(700);
  const cards = await page.evaluate(() => { const c = window.__calls.slice(); window.__calls = []; return c; });

  const tabs = ['quiz', 'fill', 'sim'];
  const out = { cards: cards };
  for (const t of tabs) {
    await page.click(`#studyTabs .tab[data-tab="${t}"]`);
    await page.waitForTimeout(600);
    // 主动触发一次「听」：quiz 点 qPlay / fill 点 fillPlay / sim 点 sPlay
    const sel = t === 'quiz' ? '#qPlay' : t === 'fill' ? '#fillPlay' : '#sPlay';
    const has = await page.$(sel);
    if (has) { await page.click(sel); await page.waitForTimeout(300); }
    // 回答第一题，看反馈是否用了 mp3
    const opt = await page.$('#qOpts .opt, #sOpts .opt');
    if (opt) { await opt.click(); await page.waitForTimeout(400); }
    out[t] = await page.evaluate(() => { const c = window.__calls.slice(); window.__calls = []; return c; });
  }

  for (const k of Object.keys(out)) {
    console.log('== ' + k + ' ==');
    out[k].forEach((c) => console.log('   audio=' + (c.audio || '(空→浏览器TTS兜底)') + '  | ' + c.text.slice(0, 42)));
  }
  await browser.close();
})();
