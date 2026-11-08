/**
 * 校验侧栏导航随页面的切换：
 *   首页            -> 只显示「职业分类」
 *   职业目录页/单章页 -> 只显示「章节导航」（不再出现职业分类）
 * 用法：node tools/verify_sidenav.js
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let bad = 0;
const ok = (m) => console.log('ok   ' + m);
const no = (m) => { bad++; console.log('FAIL ' + m); };

const state = (page) => page.evaluate(() => {
  const vis = (sel) => {
    const el = document.querySelector(sel);
    return !!el && !el.hidden && el.offsetParent !== null;
  };
  return {
    prof: vis('#profBlock'),
    chap: vis('#chapterBlock'),
    chapItems: document.querySelectorAll('#chapterNav .cnav[data-chap]').length,
    chapActive: (document.querySelector('#chapterNav .cnav.active') || {}).textContent || '',
  };
});

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => no('[pageerror] ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 1) 首页
  let s = await state(page);
  console.log('   首页: ' + JSON.stringify(s));
  s.prof && !s.chap ? ok('首页只显示职业分类') : no('首页侧栏不对: ' + JSON.stringify(s));

  // 2) 职业目录页（从首页点卡片进入）
  await page.click('#profGrid .pcard[data-p="ristorante"]');
  await page.waitForTimeout(700);
  s = await state(page);
  console.log('   目录页: ' + JSON.stringify(s));
  !s.prof && s.chap ? ok('目录页只剩章节导航') : no('目录页侧栏不对: ' + JSON.stringify(s));
  s.chapItems === 34 ? ok('章节导航 34 章齐全') : no('章节数 ' + s.chapItems + ' ≠ 34');

  // 3) 单章页
  await page.click('#chapterNav .cnav[data-chap]:nth-of-type(2)');
  await page.waitForTimeout(700);
  s = await state(page);
  console.log('   单章页: ' + JSON.stringify(s));
  !s.prof && s.chap ? ok('单章页只剩章节导航') : no('单章页侧栏不对: ' + JSON.stringify(s));
  await page.screenshot({ path: path.join(ROOT, 'tools/shots/51-sidenav-chapter.png') });

  // 4) 回首页应恢复职业分类
  await page.click('#logoHome, .brand, [data-home]');
  await page.waitForTimeout(700);
  s = await state(page);
  console.log('   回首页: ' + JSON.stringify(s));
  s.prof && !s.chap ? ok('回首页恢复职业分类') : no('回首页侧栏不对: ' + JSON.stringify(s));
  await page.screenshot({ path: path.join(ROOT, 'tools/shots/52-sidenav-home.png') });

  await browser.close();
  console.log(bad ? '\n--- FAIL ' + bad + ' ---' : '\n--- all ok ---');
  process.exit(bad ? 1 : 0);
})();
