/**
 * 校验第二个职业「美发 · 沙龙」完整接入：
 *   1) 首页 7 张职业卡 / 2 个已上线 / 美发卡可点
 *   2) 美发目录：hash、28 章、目录与侧栏序号连续 1..28、模块分组、返回按钮
 *   3) 单章页：词条行、对话中文逐句下放、情景标题、📌 要点 / 💡 补充提示、左右气泡
 *   4) 点读：点意语播 h*.mp3、点中文播 h*_zh.mp3
 *   5) 连播：意 → 中 交替
 *   6) 跨职业：收藏美发词条后回餐饮仍在；餐饮 34 章不受影响
 *   7) 学习面板在美发职业下可用
 * 用法：node tools/verify_salon.js
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
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(600);

    // 1) 首页
    const home = await page.evaluate(() => ({
      cards: document.querySelectorAll('#profGrid .pcard').length,
      ready: document.querySelectorAll('#profGrid .pcard.ready').length,
      salon: !!document.querySelector('#profGrid .pcard[data-p="parrucchiere"]'),
      salonName: (document.querySelector('#profGrid .pcard[data-p="parrucchiere"] h3') || {}).textContent || '',
    }));
    console.log('首页:', JSON.stringify(home));
    home.cards === 7 && home.ready === 2 && home.salon ? ok('首页 7 张职业卡 / 2 个已上线 / 美发卡就位') : no('首页职业卡异常');
    await page.screenshot({ path: path.join(ROOT, 'tools/shots/100-salon-home.png') });

    // 2) 美发目录
    await page.locator('#profGrid .pcard[data-p="parrucchiere"]').click();
    await page.waitForTimeout(700);
    const toc = await page.evaluate(() => ({
      hash: location.hash,
      nos: Array.from(document.querySelectorAll('#viewProf .tcard .no')).map((e) => e.textContent.trim()),
      sideNos: Array.from(document.querySelectorAll('#chapterNav .cnav:not(.toc-link) .no')).map((e) => e.textContent.trim()),
      modules: document.querySelectorAll('#viewProf .module').length,
      backBtn: !!document.querySelector('.prof-back [data-nav="home"]'),
      rows: document.querySelectorAll('#viewProf .row').length,
    }));
    console.log('美发目录:', toc.hash, '卡片', toc.nos.length, '模块', toc.modules);
    toc.hash === '#/parrucchiere' ? ok('hash 正确 #/parrucchiere') : no('hash 不对: ' + toc.hash);
    toc.nos.length === 28 && toc.nos.every((v, i) => v === String(i + 1)) ? ok('目录序号 1..28 连续') : no('目录序号异常: ' + toc.nos.join(','));
    toc.sideNos.length === 28 && toc.sideNos.every((v, i) => v === String(i + 1)) ? ok('侧栏序号 1..28 连续') : no('侧栏序号异常');
    toc.modules >= 6 ? ok('模块分组 ' + toc.modules + ' 组') : no('模块分组异常');
    toc.backBtn ? ok('返回导航页按钮存在') : no('缺返回按钮');
    toc.rows === 0 ? ok('目录页不堆词条行') : no('目录页出现词条行');
    await page.screenshot({ path: path.join(ROOT, 'tools/shots/101-salon-toc.png') });

    // 3) 进第一章
    await page.locator('#viewProf .tcard').first().click();
    await page.waitForTimeout(700);
    const chap = await page.evaluate(() => ({
      hash: location.hash,
      no: (document.querySelector('.chap-no') || {}).textContent,
      title: (document.querySelector('.chap-tt h1') || {}).textContent,
      rows: document.querySelectorAll('#viewChapter .row').length,
      dlines: document.querySelectorAll('#viewChapter .dline').length,
      scenes: document.querySelectorAll('#viewChapter .dscene').length,
      zhInBub: document.querySelectorAll('#viewChapter .dline .bub .zh.txt').length,
      tip: !!document.querySelector('.sec-tip'),
      notes: !!document.querySelector('.sec-notes'),
      sideB: document.querySelectorAll('#viewChapter .dline.b').length,
      bplay: document.querySelectorAll('#viewChapter .b-play').length,
    }));
    console.log('美发单章:', JSON.stringify(chap));
    chap.hash === '#/parrucchiere/h01' ? ok('单章 hash 正确') : no('单章 hash 不对: ' + chap.hash);
    chap.no === '1' ? ok('章节头序号 1') : no('章节头序号异常: ' + chap.no);
    chap.rows > 10 ? ok('词条行 ' + chap.rows + ' 条') : no('词条行太少');
    chap.dlines > 0 && chap.zhInBub === chap.dlines ? ok('对话 ' + chap.dlines + ' 句，中文逐句下放') : no('对话中文未逐句下放');
    chap.scenes > 0 ? ok('情景标题 ' + chap.scenes + ' 处') : no('缺情景标题');
    chap.tip ? ok('📌 本节要点显示') : no('缺本节要点');
    chap.notes ? ok('💡 补充提示折叠块显示') : no('缺补充提示');
    chap.sideB > 0 ? ok('对话左右气泡区分 ' + chap.sideB + ' 句') : no('对话气泡未区分');
    chap.bplay === 0 ? ok('无播放按钮（点文字播放）') : no('仍有播放按钮');
    await page.screenshot({ path: path.join(ROOT, 'tools/shots/102-salon-chapter.png'), fullPage: false });

    // 4) 点读（读 Audio.src，音频存在与否不影响 src 断言）
    await page.locator('#viewChapter .row .it.txt[data-t="it"]').first().click();
    await page.waitForTimeout(250);
    const srcIt = await page.evaluate(() => (window.IT.audioEl.src || '').split('/').pop());
    /^h\d+_.*\.mp3$/.test(srcIt) && !/_zh/.test(srcIt) ? ok('点意语 → 美发意语音频 ' + srcIt) : no('点意语音频异常: ' + srcIt);
    await page.locator('#viewChapter .row .zh.txt[data-t="zh"]').first().click();
    await page.waitForTimeout(250);
    const srcZh = await page.evaluate(() => (window.IT.audioEl.src || '').split('/').pop());
    /^h\d+_.*_zh\.mp3$/.test(srcZh) ? ok('点中文 → 美发中文音频 ' + srcZh) : no('点中文音频异常: ' + srcZh);

    // 5) 连播列表：直接断言 Player.list。
    //    headless Edge 的媒体时钟会被节流，靠 ended/play 事件计时不稳定（餐饮侧亦如此），
    //    列表内容才是「先意后中」逻辑的确定性证据。
    await page.evaluate(() => window.IT.player.stop());
    await page.locator('.chap-tools [data-playsec]').click();
    await page.waitForTimeout(300);
    const plist = await page.evaluate(() => window.IT.player.list.map((o) => ({ a: o.audio, lang: o.lang })));
    console.log('   连播列表:', plist.length, '段，前 4:', plist.slice(0, 4).map((x) => x.a).join(' → '));
    const zhN = plist.filter((x) => /_zh\.mp3$/.test(x.a)).length;
    const itN = plist.filter((x) => /\.mp3$/.test(x.a) && !/_zh\.mp3$/.test(x.a)).length;
    zhN > 0 && itN > 0 ? ok('连播含意语 ' + itN + ' / 中文 ' + zhN) : no('连播列表未含双语');
    let paired = 0;
    for (let i = 0; i < plist.length - 1; i++) {
      if (plist[i].lang === 'it' && plist[i + 1].lang === 'zh' &&
          plist[i + 1].a.replace('_zh.mp3', '.mp3') === plist[i].a) paired++;
    }
    paired > 0 ? ok('连播「意→中」配对 ' + paired + ' 处') : no('连播列表未检测到意→中配对');
    plist.every((x) => /^h\d+_/.test(x.a)) ? ok('连播音频全为美发 h 前缀（不与餐饮串台）') : no('连播混入其它职业音频');

    // 6) 收藏美发词条 + 跨职业
    await page.evaluate(() => window.IT.player.stop());
    await page.locator('#viewChapter .row .b-fav').first().click();
    await page.waitForTimeout(300);
    const favId = await page.evaluate(() => Object.keys(window.IT.ST.favs)[0] || '');
    /^h\d+_/.test(favId) ? ok('美发词条可收藏 ' + favId) : no('美发收藏异常: ' + favId);
    // 直接回首页并进餐饮
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForTimeout(400);
    await page.locator('#profGrid .pcard[data-p="ristorante"]').click();
    await page.waitForTimeout(600);
    const back = await page.evaluate(() => ({
      hash: location.hash,
      tocs: document.querySelectorAll('#viewProf .tcard').length,
      nos: Array.from(document.querySelectorAll('#viewProf .tcard .no')).map((e) => e.textContent.trim()),
      favCount: document.querySelectorAll('#favList .fav-item').length,
    }));
    console.log('回餐饮:', JSON.stringify({ hash: back.hash, tocs: back.tocs, favCount: back.favCount }));
    back.tocs === 34 && back.nos.every((v, i) => v === String(i + 1)) ? ok('餐饮 34 章序号仍连续，未受影响') : no('餐饮目录异常');
    back.favCount > 0 ? ok('美发收藏在首页收藏列表可见（跨职业索引正常）') : no('跨职业收藏丢失');

    // 7) 学习面板在美发下可用
    await page.evaluate(() => { location.hash = '#/parrucchiere/h01'; });
    await page.waitForTimeout(500);
    await page.locator('#btnStudyTop').click();
    await page.waitForTimeout(500);
    const study = await page.evaluate(() => ({
      open: !document.querySelector('#studyModal').hidden,
      scope: (document.querySelector('#studyScope option') || {}).textContent || '',
      cards: document.querySelectorAll('#studyBody .flashcard, #studyBody .fc').length,
    }));
    console.log('学习面板:', JSON.stringify(study));
    study.open && /美发/.test(study.scope) ? ok('学习面板自动切到美发职业') : no('学习面板职业范围未切换: ' + study.scope);
    await page.evaluate(() => { const m = document.querySelector('#studyModal'); if (m) m.hidden = true; });

    errs.length ? no('控制台报错 ' + errs.length + ' 条: ' + errs.slice(0, 3).join(' | ')) : ok('0 控制台报错');
    console.log(bad ? '\n--- FAIL ' + bad + ' ---' : '\n--- ALL OK ---');
  } catch (e) {
    console.log('ERR ' + e.message);
    bad++;
  } finally {
    const t = setTimeout(() => process.exit(bad ? 1 : 0), 3000);
    try { await browser.close(); } catch (e) { }
    clearTimeout(t);
    process.exit(bad ? 1 : 0);
  }
})();
