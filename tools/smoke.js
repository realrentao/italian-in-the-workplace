// 冒烟测试：用本机 Edge 打开站点，抓控制台错误 + 跑完整交互 + 截图
// 覆盖：首页 → 职业目录页（34 章导航）→ 单章页 → 搜索 → 学习面板 → 收藏 → 主题 → 移动端
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const OUT = path.join(ROOT, 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errs = [];
const T = 9000;   // 单次点击/等待上限，避免一处卡死拖垮整轮

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
  page.on('dialog', (d) => { console.log('DIALOG>' + d.type() + ' ' + d.message()); d.dismiss(); });
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message + ' | ' + String(e.stack || '').split('\n')[1]));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const clk = (sel, opts) => page.click(sel, Object.assign({ timeout: T }, opts));
  const step = async (name, fn) => {
    let msg = 'ok   ';
    try { await fn(); } catch (e) { msg = 'FAIL '; errs.push('[step:' + name + '] ' + e.message.split('\n')[0]); console.log('   ↑ ' + e.message.split('\n').slice(0, 30).join('\n     ')); }
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    console.log(msg + name);
  };
  const state = () => page.evaluate(() => ({
    home: !document.querySelector('#viewHome').hidden,
    prof: !document.querySelector('#viewProf').hidden,
    chap: !document.querySelector('#viewChapter').hidden,
    hash: location.hash,
    tocCards: document.querySelectorAll('#viewProf .tcard').length,
    rows: document.querySelectorAll('#viewChapter .row').length
  }));
  // 单章页底部的「下一章」：第一章时左侧的上一章是禁用占位，所以取最后一个可点项
  const nextBtn = async () => {
    const n = await page.$$eval('#viewChapter .chap-nav .cnav-btn[data-chap]', (a) => a.length);
    if (!n) throw new Error('没有上一章/下一章按钮');
    return '#viewChapter .chap-nav .cnav-btn[data-chap] >> nth=' + (n - 1);
  };

  await step('01-home', async () => {
    if (!(await state()).home) throw new Error('首屏不是首页');
  });

  await step('02-toc', async () => {
    await clk('#btnStart');
    await page.waitForTimeout(600);
    const s = await state();
    if (!s.prof) throw new Error('没进职业目录页');
    if (s.tocCards < 30) throw new Error('目录页章节卡片太少: ' + s.tocCards);
    if (s.hash !== '#/ristorante') throw new Error('hash 应该是 #/ristorante，实际 ' + s.hash);
    const mods = await page.$$eval('#viewProf .module', (a) => a.length);
    if (mods < 4) throw new Error('模块分组太少: ' + mods);
    const rowsInToc = await page.$$eval('#viewProf .row', (a) => a.length);
    if (rowsInToc) throw new Error('目录页里不该出现词条行: ' + rowsInToc);
  });

  await step('03-open-chapter', async () => {
    const id = await page.evaluate(() => document.querySelectorAll('#viewProf .tcard')[0].dataset.chap);
    await clk('#viewProf .tcard');
    await page.waitForTimeout(600);
    const s = await state();
    if (!s.chap) throw new Error('没进单章页');
    if (!s.rows) throw new Error('单章页没有内容行');
    if (s.hash !== '#/ristorante/' + id) throw new Error('hash 不对: ' + s.hash);
    const cards = await page.$$eval('#viewChapter .section-card', (a) => a.length);
    if (cards) throw new Error('单章页不该出现 section-card 折叠块: ' + cards);
  });

  await step('04-chapter-next', async () => {
    const before = await page.evaluate(() => location.hash);
    await clk(await nextBtn());
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => location.hash);
    if (after === before) throw new Error('下一章没切换');
    if (!(await state()).chap) throw new Error('下一章没渲染出来');
  });

  await step('05-keyboard-next', async () => {
    const before = await page.evaluate(() => location.hash);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => location.hash);
    if (after === before) throw new Error('键盘 → 没翻到下一章');
  });

  await step('06-back-toc', async () => {
    await clk('#viewChapter .crumb [data-nav="toc"]');
    await page.waitForTimeout(500);
    const s = await state();
    if (!s.prof) throw new Error('没回到目录页');
    if (s.hash !== '#/ristorante') throw new Error('回目录后 hash 不对: ' + s.hash);
  });

  await step('07-sidebar-nav', async () => {
    await clk('#chapterNav .cnav[data-chap] >> nth=2');
    await page.waitForTimeout(500);
    if (!(await state()).chap) throw new Error('侧栏章节导航没进单章页');
  });

  await step('08-hash-route', async () => {
    const id = await page.evaluate(() => window.IT.curProf().sections[4].id);
    await page.evaluate((x) => { location.hash = '#/ristorante/' + x; }, id);
    await page.waitForTimeout(500);
    const s = await state();
    if (!s.chap) throw new Error('直链进单章页失败');
    if (s.hash !== '#/ristorante/' + id) throw new Error('hash 不是 ' + id + ': ' + s.hash);
  });

  await step('09-search', async () => {
    await page.keyboard.press('Control+k');
    await page.fill('#searchModalInput', 'conto', { timeout: T });
    await page.waitForTimeout(400);
  });

  await step('10-search-hit', async () => {
    const n = await page.$$eval('#searchResults .srow', (a) => a.length);
    if (!n) throw new Error('搜索无结果');
  });

  await step('11-search-jump', async () => {
    await clk('#searchResults .srow >> nth=0');
    await page.waitForTimeout(900);
    if (!(await state()).chap) throw new Error('搜索点击后没跳到单章页');
  });

  await step('12-study-open', async () => {
    await clk('#btnStudyTop');
    await page.waitForTimeout(700);
    if (await page.evaluate(() => document.querySelector('#studyModal').hidden)) throw new Error('学习面板没打开');
  });

  await step('13-cards-answer', async () => {
    await clk('#fcard');
    await page.waitForTimeout(250);
    await clk('#cCtrl [data-mark]');
    await clk('#cCtrl [data-mv="1"]');
    await page.waitForTimeout(250);
  });

  await step('14-quiz-answer', async () => {
    await clk('#studyTabs .tab[data-tab="quiz"]');
    await page.waitForTimeout(400);
    await clk('#qOpts .opt >> nth=0');
    await page.waitForTimeout(300);
    if (await page.$('#qNext')) await clk('#qNext');
    await page.waitForTimeout(300);
  });

  await step('15-fill-answer', async () => {
    await clk('#studyTabs .tab[data-tab="fill"]');
    await page.waitForTimeout(400);
    await page.fill('#fillInput', 'x', { timeout: T });
    await clk('#fillOk');
    await page.waitForTimeout(400);
  });

  await step('16-sim-answer', async () => {
    await clk('#studyTabs .tab[data-tab="sim"]');
    await page.waitForTimeout(400);
    await clk('#sOpts .opt:nth-child(1)');
    await page.waitForTimeout(1000);
  });

  await step('17-stats', async () => {
    await clk('#studyTabs .tab[data-tab="stats"]');
    await page.waitForTimeout(500);
  });

  await step('18-scope-change', async () => {
    const sel = await page.$$('#studyScope option');
    if (sel.length > 2) await page.selectOption('#studyScope', { index: 2 });
    await page.waitForTimeout(400);
  });

  await step('19-close', async () => {
    await clk('#btnStudyClose');
    await page.waitForTimeout(300);
    if (!(await page.evaluate(() => document.querySelector('#studyModal').hidden))) throw new Error('学习面板没关掉');
  });

  await step('20-theme-dark', async () => { await clk('#btnTheme'); await page.waitForTimeout(350); });
  await step('21-theme-back', async () => { await clk('#btnTheme'); await page.waitForTimeout(300); });

  await step('22-fav-add', async () => {
    const before = await page.evaluate(() => Object.keys(window.IT.ST.favs || {}).length);
    const n = await page.$$eval('#viewChapter .row', (a) => a.length);
    if (!n) throw new Error('单章页没有词条行，无法测收藏');
    await page.locator('#viewChapter .row').nth(Math.min(3, n - 1)).locator('.b-fav').click({ timeout: T });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      n: Object.keys(window.IT.ST.favs || {}).length,
      ls: Object.keys(JSON.parse(localStorage.getItem('itprof_v1') || '{}').favs || {}).length
    }));
    console.log('   favs ' + before + ' -> ' + after.n + ' (localStorage ' + after.ls + ')');
    if (after.n <= before) throw new Error('点击收藏没生效');
  });

  await step('23-favsec', async () => {
    await clk('#viewChapter [data-favsec]');
    await page.waitForTimeout(400);
    const n = await page.evaluate(() => Object.keys(window.IT.ST.favs || {}).length);
    console.log('   整章收藏后共 ' + n + ' 条');
    if (n < 5) throw new Error('整章收藏没生效');
  });

  await step('24-fav-list', async () => {
    await clk('#btnFavTop');
    await page.waitForTimeout(700);
    if (!(await state()).home) throw new Error('没回到首页');
    const n = await page.$$eval('#favList .fav-item', (a) => a.length);
    if (!n) throw new Error('收藏列表为空');
    console.log('   收藏列表 ' + n + ' 条');
  });

  await step('25-fav-jump', async () => {
    await clk('#favList .fav-item >> nth=0');
    await page.waitForTimeout(900);
    if (!(await state()).chap) throw new Error('收藏点击后没跳到单章页');
  });

  await step('26-goto-home', async () => {
    await clk('.brand');
    await page.waitForTimeout(500);
    if (!(await state()).home) throw new Error('点 logo 没回首页');
  });

  await step('27-placeholder', async () => {
    await clk('#profNav .pnav >> nth=2');
    await page.waitForTimeout(300);
    if (!(await state()).home) throw new Error('占位职业不该跳走');
  });

  // 移动端（用独立 context：localStorage 干净，首屏才是首页）
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await mctx.newPage();
  await m.goto(URL, { waitUntil: 'load' });
  await m.waitForTimeout(600);
  await m.screenshot({ path: path.join(OUT, '30-mobile-home.png') });
  await m.click('#btnDrawer', { timeout: T });
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(OUT, '31-mobile-drawer.png') });
  await m.click('#drawerMask', { position: { x: 340, y: 500 }, timeout: T });
  await m.waitForTimeout(300);
  await m.click('#btnStart', { timeout: T });
  await m.waitForTimeout(700);
  await m.screenshot({ path: path.join(OUT, '32-mobile-toc.png') });
  await m.click('#viewProf .tcard', { timeout: T });
  await m.waitForTimeout(700);
  await m.screenshot({ path: path.join(OUT, '33-mobile-chapter.png') });
  await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(OUT, '34-mobile-chapter-foot.png') });
  await m.click('#btnStudyTop', { timeout: T });
  await m.waitForTimeout(800);
  await m.screenshot({ path: path.join(OUT, '35-mobile-study.png') });

  const stat = await page.evaluate(() => ({
    profCards: document.querySelectorAll('#profGrid .pcard').length,
    ready: document.querySelectorAll('#profGrid .pcard.ready').length,
    tocCards: document.querySelectorAll('#viewProf .tcard').length,
    sections: window.IT.curProf().sections.length,
    rows: document.querySelectorAll('#viewChapter .row').length,
    total: window.IT ? window.IT.ALL.length : -1
  }));
  console.log('STAT ' + JSON.stringify(stat));

  console.log('--- errors (' + errs.length + ') ---');
  errs.slice(0, 40).forEach((e) => console.log(e));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
