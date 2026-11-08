const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const clk = (sel) => page.click(sel, { timeout: 6000 });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 复现 step 09-11
  await page.keyboard.press('Control+k');
  await page.fill('#searchModalInput', 'conto', { timeout: 6000 });
  await page.waitForTimeout(400);
  const hitTxt = await page.evaluate(() => {
    const row = document.querySelector('#searchResults .srow');
    if (!row) return null;
    const r = row.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { centerClass: t ? (t.className || t.tagName) : null, isTxt: !!(t && t.closest && t.closest('.txt')) };
  });
  console.log('search result center:', JSON.stringify(hitTxt));
  await clk('#searchResults .srow >> nth=0');
  await page.waitForTimeout(900);

  const after = await page.evaluate(() => {
    const btn = document.querySelector('#btnStudyTop');
    const r = btn.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      chap: !document.querySelector('#viewChapter').hidden,
      searchHidden: document.querySelector('#searchModal').hidden,
      studyHidden: document.querySelector('#studyModal').hidden,
      playerHidden: document.querySelector('#player').hidden,
      topElAtBtn: top ? (top.id || top.className || top.tagName) : null,
      btnCovered: top !== btn,
    };
  });
  console.log('AFTER SEARCH-JUMP', JSON.stringify(after, null, 2));
  console.log('ERRS', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})();
