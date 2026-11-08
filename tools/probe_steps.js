// 逐步探针：每跑完一个 smoke 步骤，就在页面里 JS 点一下第 4 行的收藏按钮，看监听器还在不在
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror] ' + e.message));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const probe = async (label) => {
    const r = await page.evaluate(() => {
      const rows = document.querySelectorAll('#viewProf .row');
      if (!rows.length) return { skip: true, rows: 0 };
      const f = rows[3].querySelector('.b-fav');
      if (!f) return { skip: true, rows: rows.length };
      f.click();
      const IT = window.IT;
      return { rows: rows.length, favs: Object.keys(IT && IT.ST ? IT.ST.favs || {} : {}) };
    });
    if (!r.skip) {
      if (r.favs.length) { console.log('PROBE-OK   ' + label + '  ' + JSON.stringify(r)); await page.evaluate(() => { const IT = window.IT; Object.keys(IT.ST.favs).forEach((k) => IT.toggleFav(k)); }); }
      else console.log('PROBE-DEAD ' + label + '  ' + JSON.stringify(r));
    } else console.log('PROBE-SKIP ' + label + '  ' + JSON.stringify(r));
    return r;
  };

  await probe('00-home');

  await page.click('#btnStart'); await page.waitForTimeout(600); await probe('01-prof');
  const head = page.locator('#viewProf .section-card').first().locator('.sec-head');
  await head.click(); await page.waitForTimeout(300); await probe('02-collapse');
  await head.click(); await page.waitForTimeout(400); await probe('03-expand');
  await page.keyboard.press('Control+k');
  await page.fill('#searchModalInput', 'conto'); await page.waitForTimeout(400);
  await page.click('#btnSearchClose'); await page.waitForTimeout(300); await probe('04-search-close');
  await page.click('#btnStudyTop'); await page.waitForTimeout(700); await probe('05-study-open');
  await page.click('#fcard'); await page.waitForTimeout(300); await probe('06-card');
  await page.click('#cCtrl [data-mark]'); await page.click('#cCtrl [data-mv="1"]'); await page.waitForTimeout(300); await probe('07-card-ctrl');
  await page.click('#studyTabs .tab[data-tab="quiz"]'); await page.waitForTimeout(400); await probe('08-quiz');
  await page.click('#qOpts .opt >> nth=0'); await page.waitForTimeout(300); await probe('09-quiz-ans');
  if (await page.$('#qNext')) await page.click('#qNext'); await page.waitForTimeout(300); await probe('10-quiz-next');
  await page.click('#studyTabs .tab[data-tab="fill"]'); await page.waitForTimeout(400); await probe('11-fill');
  await page.fill('#fillInput', 'x'); await page.click('#fillOk'); await page.waitForTimeout(400); await probe('12-fill-wrong');
  await page.click('#studyTabs .tab[data-tab="sim"]'); await page.waitForTimeout(400); await probe('13-sim');
  await page.click('#sOpts .opt:nth-child(1)'); await page.waitForTimeout(1200); await probe('14-sim-ans');
  await page.click('#studyTabs .tab[data-tab="stats"]'); await page.waitForTimeout(500); await probe('15-stats');
  const sel = await page.$$('#studyScope option');
  if (sel.length > 2) await page.selectOption('#studyScope', { index: 2 });
  await page.waitForTimeout(500); await probe('16-scope');
  await page.click('#btnStudyClose'); await page.waitForTimeout(300); await probe('17-close');
  await page.click('#btnTheme'); await page.waitForTimeout(400); await probe('18-theme-dark');
  await page.click('#btnTheme'); await page.waitForTimeout(300); await probe('19-theme-back');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
