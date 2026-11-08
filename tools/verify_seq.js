const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    // 目录（TOC）
    await page.goto('file://' + __dirname + '/../index.html#/ristorante');
    await page.waitForTimeout(700);
    await page.screenshot({ path: __dirname + '/shots/90-toc-seq.png', fullPage: false });

    const tocNos = await page.$$eval('#viewProf .tcard .no', els => els.map(e => e.textContent.trim()));
    console.log('TOC 卡片号:', tocNos.join(','));
    const tocOk = tocNos.length === 34 && tocNos.every((v, i) => v === String(i + 1));
    console.log(tocOk ? 'OK  TOC 连续 1..34' : 'FAIL TOC 不连续');

    const sideNos = await page.$$eval('#chapterNav .cnav:not(.toc-link) .no', els => els.map(e => e.textContent.trim()));
    console.log('侧栏号(前12):', sideNos.slice(0, 12).join(','));
    const sideOk = sideNos.length >= 34 && sideNos.slice(0, 34).every((v, i) => v === String(i + 1));
    console.log(sideOk ? 'OK  侧栏连续' : 'FAIL 侧栏不连续');

    // 进第一章看章节头 + 上下章
    await page.goto('file://' + __dirname + '/../index.html#/ristorante/s01');
    await page.waitForTimeout(700);
    const chapNo = await page.$eval('.chap-no', e => e.textContent.trim());
    console.log('章节头号:', chapNo, chapNo === '1' ? 'OK' : 'FAIL');
    const prevNext = await page.$$eval('.chap-nav .cnav-btn b', els => els.map(e => e.textContent.trim().split(' ')[0]));
    console.log('上下章前缀号:', JSON.stringify(prevNext));

    // 进中间一章（s10 大概），确认编号仍连续对齐
    await page.goto('file://' + __dirname + '/../index.html#/ristorante/s10');
    await page.waitForTimeout(600);
    const chapNo2 = await page.$eval('.chap-no', e => e.textContent.trim());
    console.log('s10 章节头号:', chapNo2);

    console.log('errs:', errs.length ? errs : 'none');
    console.log((tocOk && sideOk && chapNo === '1') ? '--- ALL OK ---' : '--- FAIL ---');
  } catch (e) {
    console.log('ERR', e.message);
  } finally {
    const t = setTimeout(() => process.exit(0), 3000);
    try { await browser.close(); } catch (e) {}
    clearTimeout(t);
    process.exit(0);
  }
})();
