/**
 * 校验「餐饮 总页面」上的「返回导航页」按钮：
 *   进入职业目录页 -> 按钮可见 -> 点击 -> 回到首页（职业分类恢复）
 * 用法：node tools/verify_back_button.js
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let bad = 0;
const ok = (m) => console.log('ok   ' + m);
const no = (m) => { bad++; console.log('FAIL ' + m); };

const vis = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return !!el && !el.hidden && el.offsetParent !== null;
}, sel);

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => no('[pageerror] ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 1) 进入餐饮职业目录页
  await page.click('#profGrid .pcard[data-p="ristorante"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(ROOT, 'tools/shots/60-back-btn.png') });

  // 2) 按钮存在且可见
  const btnText = await page.evaluate(() => {
    const b = document.querySelector('#viewProf .prof-back .chip.back');
    return b ? b.textContent.trim() : null;
  });
  console.log('   返回按钮文案: ' + JSON.stringify(btnText));
  btnText === '← 返回导航页' ? ok('返回按钮文案正确') : no('返回按钮文案不对: ' + btnText);
  (await vis(page, '#viewProf .prof-back .chip.back')) ? ok('返回按钮可见') : no('返回按钮不可见');

  // 3) 当前在职业页：职业分类应隐藏
  const beforeProf = await vis(page, '#profBlock');
  beforeProf === false ? ok('职业页侧栏只留章节') : no('职业页仍显示职业分类');

  // 4) 点击返回按钮
  await page.click('#viewProf .prof-back .chip.back');
  await page.waitForTimeout(700);

  // 5) 回到首页
  const homeVis = await vis(page, '#viewHome');
  const profVisAfter = await vis(page, '#profBlock');
  console.log('   点击后: home=' + homeVis + ' profBlock=' + profVisAfter);
  homeVis ? ok('点击后回到首页') : no('点击后首页不可见');
  profVisAfter ? ok('首页恢复职业分类') : no('首页未恢复职业分类');
  await page.screenshot({ path: path.join(ROOT, 'tools/shots/61-back-home.png') });

  await browser.close();
  console.log(bad ? '\n--- FAIL ' + bad + ' ---' : '\n--- all ok ---');
  process.exit(bad ? 1 : 0);
})();
