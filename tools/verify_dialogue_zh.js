/* 校验：情景对话的中文必须逐句显示在每句台词下方，而不是只在顶部整段串讲。
   同时守住「情景模拟默认不显示中文」（那是听力题）。
   用法：node tools/verify_dialogue_zh.js       exit=0 全绿 */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const fails = [];
const say = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
  await page.goto(URL + '#/ristorante/s01', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  /* 1. 单章页：每句台词下面都要有中文 */
  const lines = await page.$$eval('#viewChapter .dialog .dline', (els) => els.map((el) => ({
    who: (el.querySelector('.who') || {}).textContent || '',
    it: (el.querySelector('.bub .it') || {}).textContent || '',
    zh: (el.querySelector('.bub .zh') || {}).textContent || ''
  })));
  say(lines.length > 0, '单章页找到对话 ' + lines.length + ' 句');
  lines.forEach((l) => say(!!l.zh.trim(), l.who + ' 「' + l.it.slice(0, 26) + '」下方中文：' + l.zh.slice(0, 26)));
  const empty = lines.filter((l) => !l.zh.trim()).length;
  if (empty) fails.push(empty + ' 句台词没有中文');

  /* 2. 顶部整段串讲应该已经撤掉（中文下放后不重复） */
  const dsum = await page.$$eval('#viewChapter .dsum', (e) => e.length);
  say(dsum === 0, '顶部整段串讲已移除（.dsum 数量=' + dsum + '）');

  /* 3. 情景模拟：中文默认藏起来，点「👁 看中文」才显示，答完自动亮出 */
  await page.evaluate(() => window.Study.start('sim', 'ristorante', null));
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => {
    const z = document.querySelector('#sAZh');
    return { has: !!z, hidden: z ? z.hidden : null, txt: z ? z.textContent : '' };
  });
  say(before.has && before.hidden === true, '情景模拟默认隐藏 A 中文（关键：这是听力题）');
  say(!!before.txt.trim(), 'A 台词中文已就位：' + before.txt.slice(0, 24));
  const btn = await page.$('#sZh');
  if (btn) { await btn.click(); await page.waitForTimeout(150); }
  const afterToggle = await page.evaluate(() => { const z = document.querySelector('#sAZh'); return z ? z.hidden : null; });
  say(afterToggle === false, '点「👁 看中文」后显示');
  await page.click('#sOpts .opt');
  await page.waitForTimeout(400);
  const afterAns = await page.evaluate(() => {
    const z = document.querySelector('#sAZh');
    return { hidden: z ? z.hidden : null, msg: (document.querySelector('#sMsg') || {}).textContent || '' };
  });
  say(afterAns.hidden === false, '答完自动亮出中文');
  say(!!afterAns.msg.trim(), '答完有反馈文案：' + afterAns.msg.slice(0, 28));

  await page.screenshot({ path: path.join(__dirname, 'shots', '41-dialogue-zh.png'), fullPage: false });
  console.log('\n--- errors (' + fails.length + ') ---');
  fails.forEach((f) => console.log('  ' + f));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
