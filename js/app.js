/* ==========================================================
   意大利语职场实战站 — 主程序（导航 / 渲染 / 播放 / 收藏 / 搜索）
   ========================================================== */
(function () {
  'use strict';
  const DB = window.APP_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- 本地存储 ---------------- */
  const LS = 'itprof_v1';
  const DEF = { marks: {}, favs: {}, days: {}, quiz: { n: 0, ok: 0 }, fill: { n: 0, ok: 0 }, sim: { n: 0, ok: 0 }, theme: 'light', rate: 0.95, lastProf: 'ristorante' };
  let ST = load();
  function load() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) { } }

  /* ---------------- 数据索引 ---------------- */
  const PROF = {};
  DB.professions.forEach((p) => (PROF[p.id] = p));
  const READY = DB.professions.filter((p) => p.status === 'ready');
  const curProf = () => PROF[cur.profId] || READY[0];

  const cur = { profId: READY[0].id, secId: null, home: true };
  let lastHash = '';   // 已同步的 hash，用来区分「我们写的」和「用户点后退」

  // 全量条目索引: id -> {item, sec, prof}
  const ALL = [];
  READY.forEach((p) => p.sections.forEach((s) => {
    s.items.forEach((it) => {
      if (it.t === 'd') { it.lines.forEach((ln, i) => ALL.push({ id: ln.id, item: ln, sec: s, prof: p, kind: 'd' })); }
      else { ALL.push({ id: it.id, item: it, sec: s, prof: p, kind: it.t }); }
    });
    if (s.blocks) s.blocks.forEach((b) => b.ex.forEach((e) => ALL.push({ id: e.id, item: e, sec: s, prof: p, kind: 'ex' })));
  }));
  const IDX = {};
  ALL.forEach((a) => (IDX[a.id] = a));

  // 按章节归拢条目（用于目录页算每章条数 / 掌握度）
  const SECITEM = {};
  ALL.forEach((a) => { (SECITEM[a.sec.id] = SECITEM[a.sec.id] || []).push(a); });

  function sectionById(profId, secId) {
    const p = PROF[profId];
    return p && p.sections.find((s) => s.id === secId);
  }
  function secItems(s) { return SECITEM[s.id] || []; }
  // 掌握度：● 记满分，◐ 记一半
  function secMastered(s) {
    const l = secItems(s);
    return l.filter((a) => markOf(a.id) === 2).length + l.filter((a) => markOf(a.id) === 1).length * 0.5;
  }
  function secProgress(s) {
    const n = secItems(s).length || 1;
    return Math.min(100, Math.round((secMastered(s) / n) * 100));
  }
  function openSections(p) {
    // 返回该职业的章节列表（按模块顺序）
    const order = [];
    (p.modules || []).forEach((m) => m.sectionIds.forEach((sid) => { const s = sectionById(p.id, sid); if (s) order.push(s); }));
    p.sections.forEach((s) => { if (order.indexOf(s) < 0) order.push(s); });
    return order;
  }

  /* ---------------- 音频 / 播放器 ---------------- */
  const Audio1 = new Audio();
  Audio1.preload = 'none';

  function speakFallback(text, lang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (lang === 'zh') ? 'zh-CN' : 'it-IT';
    u.rate = 0.85;
    const vs = window.speechSynthesis.getVoices() || [];
    const want = (lang === 'zh') ? /^zh/i : /^it/i;
    const v = vs.find((x) => want.test(x.lang)) || vs.find((x) => want.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }

  const Player = {
    list: [], i: 0, playing: false, loop: true, onEnd: null,
    playOne(o) { this.setList([o]); this.start(); },
    setList(list) { this.list = list || []; this.i = 0; },
    start() {
      if (!this.list.length) { this.hide(); return; }
      this.show();
      this.step(0);
    },
    step(i) {
      if (i >= this.list.length) {
        if (this.loop && this.list.length > 1) { this.i = 0; this.step(0); return; }
        this.stop(); return;
      }
      this.i = i;
      const o = this.list[i];
      // 连播跨章时自动翻到那一章（静默：不写 hash、不滚顶），保证高亮的永远是当前页
      if (o.secId && o.secId !== cur.secId && !cur.home && $('#studyModal').hidden) openChapter(o.secId, true);
      const el = o.id ? $('#main [data-id="' + o.id + '"]') : o.el;
      this.render(o);
      // 高亮当前正在朗读的那段文字：意语高亮 .it、中文高亮 .zh
      let target = el;
      if (el && o.lang) { const t = el.querySelector('.txt[data-t="' + o.lang + '"]'); if (t) target = t; }
      this.highlight(target);
      const mp3 = 'audio/' + String(o.audio || '');
      Audio1.pause();
      Audio1.src = mp3;
      Audio1.playbackRate = ST.rate || 0.95;
      const go = () => this.step(i + 1);
      Audio1.onended = go;
      Audio1.onerror = () => { speakFallback(String(o.text || ''), o.lang); Audio1.onended = go; };
      const pr = Audio1.play();
      if (pr && pr.catch) pr.catch(() => { speakFallback(String(o.text || ''), o.lang); Audio1.onended = go; });
      this.playing = true;
      $('#plToggle').textContent = '⏸';
    },
    toggle() {
      if (this.playing) { Audio1.pause(); this.playing = false; $('#plToggle').textContent = '▶'; if (window.speechSynthesis) speechSynthesis.pause(); }
      else { this.playing = true; $('#plToggle').textContent = '⏸'; if (Audio1.src) { Audio1.play().catch(() => { }); if (window.speechSynthesis) speechSynthesis.resume(); } else this.step(this.i); }
    },
    stop() { Audio1.pause(); Audio1.onended = null; if (window.speechSynthesis) speechSynthesis.cancel(); this.playing = false; $('#plToggle').textContent = '▶'; this.hide(); },
    next() { Audio1.pause(); if (window.speechSynthesis) speechSynthesis.cancel(); this.step(this.i + 1); },
    prev() { Audio1.pause(); if (window.speechSynthesis) speechSynthesis.cancel(); this.step(Math.max(0, this.i - 1)); },
    render(o) {
      $('#plTitle').textContent = o.title || o.text || '';
      $('#plSub').textContent = o.sub || (this.i + 1) + ' / ' + this.list.length;
    },
    highlight(el) {
      $$('.cur').forEach((e) => e.classList.remove('cur'));
      if (el && el.classList) el.classList.add('cur');
      // 学习面板开着时不滚动背景页面：既避免答题时页面乱跳，也防止平滑滚动与其它滚动打架
      if (el && el.scrollIntoView && $('#studyModal').hidden) {
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
      }
    },
    show() { $('#player').hidden = false; },
    hide() { if (!this.playing) $('#player').hidden = true; }
  };
  Player.loop = true;

  // 生成一条可播放记录（id / secId 用于连播时自动翻章 + 现查高亮元素）
  // lang: 'it' | 'zh' —— 决定高亮的是哪段文字，以及缺音频时用什么嗓音兜底
  function playable(text, audio, lang, label, el, sub, id, secId) {
    return { text: text, audio: audio, lang: lang || '', title: label, sub: sub, el: el, id: id, secId: secId };
  }

  /* ---------------- 收藏 / 掌握度 ---------------- */
  const isFav = (id) => !!ST.favs[id];
  function toggleFav(id) {
    if (ST.favs[id]) delete ST.favs[id]; else ST.favs[id] = 1;
    save(); renderFavCount(); renderStarButtons(id); renderFavList(); syncSecFavBtn();
  }
  function markOf(id) { return ST.marks[id] || 0; }
  function setMark(id, v) { ST.marks[id] = v; save(); renderMarkButtons(id); updateProgress(); }
  function cycleMark(id, cur2) { setMark(id, ((cur2 || markOf(id)) + 1) % 3); }
  function markLabel(v) { return ['○', '◐', '●'][v]; }
  function touchDay() {
    const d = new Date().toISOString().slice(0, 10);
    ST.days[d] = (ST.days[d] || 0) + 1;
    save();
  }
  function streakDays() {
    let n = 0; const d = new Date();
    for (let i = 0; i < 400; i++) {
      const k = d.toISOString().slice(0, 10);
      if (ST.days[k]) { n++; d.setDate(d.getDate() - 1); } else { if (i === 0) { d.setDate(d.getDate() - 1); continue; } break; }
    }
    return n;
  }

  function updateProgress() {
    let master = 0, learn = 0;
    ALL.forEach((a) => { const m = markOf(a.id); if (m === 2) master++; else if (m === 1) learn++; });
    const total = ALL.length || 1;
    const pct = Math.round(((master + learn * 0.5) / total) * 100);
    $('#sideProg').textContent = pct + '%';
    $('#sideProgBar').style.width = pct + '%';
    $('#heroNum').textContent = pct + '%';
    const C = 2 * Math.PI * 52;
    $('#heroRing').style.strokeDasharray = C;
    $('#heroRing').style.strokeDashoffset = C * (1 - (master + learn * .5) / total);
    $('#statMastered').textContent = master;
    $('#statLearning').textContent = learn;
    $('#statStreak').textContent = streakDays();
    $('#statDays').textContent = Object.keys(ST.days || {}).length;
    renderFavCount();
  }
  function renderFavCount() { $('#favCount').textContent = Object.keys(ST.favs || {}).length; }

  /* ---------------- 导航渲染 ---------------- */
  function renderProfNav() {
    $('#profNav').innerHTML = DB.professions.map((p) => {
      const ph = p.status !== 'ready';
      return `<a class="pnav ${ph ? 'placeholder' : ''} ${p.id === cur.profId && !cur.home ? 'active' : ''}" href="#" data-p="${p.id}">
        <span class="ic">${p.icon}</span><span class="nm">${esc(p.name)}</span>
        <span class="st">${ph ? '待补充' : '已上线'}</span></a>`;
    }).join('');
  }

  // 侧栏章节导航：点一下直接进那一章（不再折叠展开）
  function renderChapterNav() {
    const p = curProf();
    const secs = openSections(p);
    if (cur.home || !secs.length) { $('#chapterBlock').hidden = true; return; }
    $('#chapterBlock').hidden = false;
    const tocActive = cur.secId ? '' : 'active';
    let html = `<div class="cnav toc-link ${tocActive}" data-nav="toc"><span class="no">☰</span><span>章节目录（共 ${secs.length} 章）</span></div>`;
    (p.modules || []).forEach((m) => {
      const items = secs.filter((s) => m.sectionIds.indexOf(s.id) >= 0);
      if (!items.length) return;
      const done = items.filter((s) => secProgress(s) === 100).length;
      html += `<details class="cgroup" open>
        <summary class="cgroup-t"><i></i>${esc(m.title)}<span class="cg-cnt">${done}/${items.length}</span></summary>` +
        items.map((s) => `<div class="cnav ${s.id === cur.secId ? 'active' : ''}" data-chap="${s.id}"><span class="no">${esc(s.seq)}</span><span class="cnav-t">${esc(s.title.replace('语法 · ', ''))}</span></div>`).join('') +
        '</details>';
    });
    const rest = secs.filter((s) => !(p.modules || []).some((m) => m.sectionIds.indexOf(s.id) >= 0));
    if (rest.length) html += rest.map((s) => `<div class="cnav ${s.id === cur.secId ? 'active' : ''}" data-chap="${s.id}"><span class="no">${esc(s.seq)}</span><span class="cnav-t">${esc(s.title)}</span></div>`).join('');
    $('#chapterNav').innerHTML = html;
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    cur.home = true;
    showView('home');
    $('#profGrid').innerHTML = DB.professions.map((p) => {
      const ph = p.status !== 'ready';
      let foot = ph ? '<span class="tag">待补充</span>' : '<span>共 ' + openSections(p).length + ' 章 · 进入 →</span>';
      return `<article class="pcard ${ph ? 'ph' : 'ready'}" data-p="${p.id}" style="--c:${p.color}">
        <div class="ic">${p.icon}</div>
        <h3>${esc(p.name)}</h3>
        <div class="it">${esc(p.nameIt || '')}</div>
        <p>${esc(p.desc || '')}</p>
        <div class="foot">${ph ? '<span class="tag">敬请期待</span>' : '<span class="tag">已上线</span><span>' + foot.slice(4) + '</span>'}</div>
      </article>`;
    }).join('');
    // 职业卡片的点击走全局委托（bindViewEvents），这里不再逐个绑
    renderFavList();
    renderProfNav();
    updateProgress();
  }

  function renderFavList() {
    const ids = Object.keys(ST.favs || {});
    const box = $('#favList');
    if (!ids.length) { box.innerHTML = '<p class="empty">还没有收藏，点任意词条右侧的 ☆ 即可收藏。</p>'; return; }
    box.innerHTML = ids.map((id) => {
      const a = IDX[id]; if (!a) return '';
      return `<div class="fav-item" data-id="${id}">
        <div style="min-width:0;flex:1">
          <div class="it txt" data-t="it" title="点击听意语">${esc(a.item.it || '')}</div>
          <div class="zh txt" data-t="zh" title="点击听中文">${esc(a.item.zh || a.item.num || '')}</div>
          <div class="meta">${esc(a.prof.name)} · ${esc(a.sec.title)}</div>
        </div>
        <button class="mini-btn b-unfav" title="取消收藏">✕</button>
      </div>`;
    }).join('');
    // 收藏列表的按钮走 bindViewEvents 的委托，这里只管渲染
  }

  /* ---------------- 视图切换 / 路由 ----------------
     三层：首页 #/ · 职业目录页 #/<profId> · 单章页 #/<profId>/<secId>
     各职业章节不再堆在一页，目录页只放导航卡片，点进去才渲染那一章的内容。 */
  function showView(which) {
    $('#viewHome').hidden = which !== 'home';
    $('#viewProf').hidden = which !== 'prof';
    $('#viewChapter').hidden = which !== 'chap';
    // 侧栏随页面切换：首页给「职业分类」，进了职业就只留「章节导航」
    const pb = $('#profBlock');
    if (pb) pb.hidden = which !== 'home';
    if (which === 'home') $('#chapterBlock').hidden = true;
  }
  function hashOf() { return cur.home ? '#/' : '#/' + cur.profId + (cur.secId ? '/' + cur.secId : ''); }
  function applyHash() {
    lastHash = hashOf();
    if (location.hash !== lastHash) location.hash = lastHash;
  }

  function goHome(toFav) {
    cur.home = true; cur.secId = null;
    showView('home');
    renderHome(); renderProfNav(); renderChapterNav();
    applyHash();
    if (toFav) $('#favSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    closeDrawer();
  }

  // 职业目录页（章节导航总览）
  function gotoProf(id, silent) {
    const p = PROF[id];
    if (!p || p.status !== 'ready') {
      toast('该职业内容还在准备中，可先学已上线的：' + READY.map((x) => x.name).join('、'));
      return;
    }
    cur.profId = id; cur.home = false; cur.secId = null;
    ST.lastProf = id; save();
    renderProfView(); renderProfNav(); renderChapterNav();
    if (!silent) { applyHash(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    closeDrawer();
  }

  // 单章页。silent=true 用于连播自动翻章：不写 hash、不滚顶部
  function openChapter(secId, silent) {
    const p = curProf();
    const s = sectionById(p.id, secId);
    if (!s) return;
    cur.home = false; cur.secId = secId;
    renderChapterView(s); renderChapterNav(); renderProfNav();
    if (!silent) { applyHash(); window.scrollTo({ top: 0, behavior: 'smooth' }); closeDrawer(); }
  }
  function chapterStep(d) {
    if (cur.home || !cur.secId) return;
    const secs = openSections(curProf());
    const i = secs.findIndex((s) => s.id === cur.secId);
    const n = secs[i + d];
    if (n) openChapter(n.id);
  }

  // 全局事件委托：首页 / 目录页 / 单章页 / 弹层共用一个 click 委托，
  // 任何 innerHTML 重绘都不会丢事件（这类 bug 踩过一次，不再用逐元素绑定）。
  function bindViewEvents() {
    if (document.__delegated) return;
    document.__delegated = 1;
    document.addEventListener('click', onDocClick);
  }
  function navTo(nav) {
    if (nav === 'home') goHome();
    else if (nav === 'toc') gotoProf(cur.profId);
  }
  function onDocClick(e) {
    const raw = e.target;
    const btn = raw.closest && raw.closest('button');
    if (btn) {
      const d = btn.dataset;
      if (d.chap) { e.preventDefault(); openChapter(d.chap); return; }
      if (d.nav) { e.preventDefault(); navTo(d.nav); return; }
      if (d.playsec) { playSection(d.playsec); return; }
      if (d.favsec) { toggleSecFav(d.favsec); return; }
      if (d.quiz || d.fill || d.sim) {
        if (window.Study) Study.start(d.quiz ? 'quiz' : d.fill ? 'fill' : 'sim', curProf().id, d.quiz || d.fill || d.sim);
        return;
      }
      if (btn.hasAttribute('data-playall')) { playSection(null); return; }
      if (btn.classList.contains('b-fav')) { toggleFav(d.id); return; }
      if (btn.classList.contains('b-mark')) { cycleMark(d.id, +d.m); return; }
      if (btn.classList.contains('b-unfav')) { const it = btn.closest('.fav-item'); if (it) toggleFav(it.dataset.id); return; }
      if (btn.id === 'btnStudy') { openStudy(); return; }
      return;   // 其余按钮（顶栏 / 播放器 / 弹层）由各自监听器处理
    }
    // 点文字即播放：意语 / 中文分开点读（仅章节正文区；搜索结果/收藏夹整行仍是跳转入口）
    const txt = raw.closest && raw.closest('.txt');
    if (txt) {
      const host = txt.closest('[data-id]');
      if (host && host.closest('#viewChapter')) {
        e.preventDefault();
        playText(host.dataset.id, txt.dataset.t);
        return;
      }
    }
    const el = raw.closest && raw.closest('[data-chap],[data-nav],.pcard,.pnav,.cnav,.fav-item,.srow');
    if (!el) return;
    const d = el.dataset;
    if (d.chap) { e.preventDefault(); openChapter(d.chap); return; }
    if (d.nav) { e.preventDefault(); navTo(d.nav); return; }
    if (d.p) { e.preventDefault(); gotoProf(d.p); return; }
    if (el.classList.contains('fav-item')) { gotoItem(d.id); return; }
    if (el.classList.contains('srow')) { $('#searchModal').hidden = true; gotoItem(d.id); return; }
  }

  /* ---------------- 目录页（各职业章节的导航总览） ---------------- */
  function tocCard(s) {
    const n = secItems(s).length;
    const pct = secProgress(s);
    return `<button class="tcard ${pct === 100 ? 'done' : ''}" data-chap="${s.id}">
      <span class="no">${esc(s.seq)}</span>
      <span class="tt"><b>${esc(s.title)}</b><small>${esc(s.titleIt || '')}</small></span>
      <span class="tmeta">${s.blocks ? '语法点' : n + ' 条'} · 掌握 ${pct}%</span>
      <span class="tbar"><i style="width:${pct}%"></i></span>
    </button>`;
  }

  function renderProfView() {
    const p = curProf();
    showView('prof');
    const secs = openSections(p);
    const totalItem = secs.reduce((n, s) => n + secItems(s).length, 0);
    const mastered = Math.round(secs.reduce((n, s) => n + secMastered(s), 0));
    const resume = secs.find((s) => secProgress(s) < 100) || secs[0];
    const allDone = secs.every((s) => secProgress(s) === 100);

    let html = `<div class="prof-back">
      <button class="chip back" data-nav="home">← 返回导航页</button>
    </div>
    <div class="prof-head">
      <span class="ic">${p.icon}</span>
      <div><h1>${esc(p.name)}</h1><div class="it">${esc(p.nameIt || '')}${p.desc ? ' · ' + esc(p.desc) : ''}</div></div>
      <div class="prof-actions">
        <button class="chip on" data-chap="${resume.id}">${allDone ? '↺ 从头再学：' : '▶ 继续学：'}${esc(resume.seq)} ${esc(resume.title)}</button>
        <button class="chip" data-playall="1">▶ 连播全部 ${secs.length} 章</button>
        <button class="chip" id="btnStudy">🎓 学习练习</button>
      </div></div>
      <div class="stat-strip">
        <div class="stat-pill"><b>${secs.length}</b>章节</div>
        <div class="stat-pill"><b>${totalItem}</b>条目</div>
        <div class="stat-pill"><b>${mastered}</b>已掌握</div>
        <div class="stat-pill"><b>${Object.keys(ST.favs || {}).length}</b>收藏</div>
      </div>
      <p class="toc-hint">共 ${secs.length} 章，按模块分组 —— 点一张卡片进入单章学习。键盘 <kbd>←</kbd> <kbd>→</kbd> 翻上下一章。</p>`;

    const used = [];
    (p.modules || []).forEach((m) => {
      const list = secs.filter((s) => m.sectionIds.indexOf(s.id) >= 0);
      if (!list.length) return;
      used.push(...list.map((s) => s.id));
      const done = list.filter((s) => secProgress(s) === 100).length;
      html += `<section class="module">
        <h3 class="module-t">${esc(m.title)} <small>${esc(m.titleIt || '')}</small>
          <span class="mod-cnt">${done} / ${list.length} 章掌握</span></h3>
        <div class="toc-grid">${list.map(tocCard).join('')}</div></section>`;
    });
    const rest = secs.filter((s) => used.indexOf(s.id) < 0);
    if (rest.length) html += `<section class="module"><h3 class="module-t">更多章节</h3><div class="toc-grid">${rest.map(tocCard).join('')}</div></section>`;

    html += '<div style="padding:20px 0;color:var(--muted);font-size:12.5px">— 本职业内容完 · 想补充其他职业（医疗 / 法律 / 酒店 / 工程 / 商贸）请告诉我 —</div>';
    $('#viewProf').innerHTML = html;
  }

  /* ---------------- 单章页 ---------------- */
  function renderChapterView(s) {
    const p = curProf();
    const secs = openSections(p);
    const idx = secs.indexOf(s);
    const items = secItems(s);
    const master = items.filter((a) => markOf(a.id) === 2).length;
    const favN = items.filter((a) => isFav(a.id)).length;
    const allFav = items.length > 0 && favN === items.length;
    const prev = secs[idx - 1], next = secs[idx + 1];
    const body = s.blocks ? renderGrammar(s) : renderItems(s);

    $('#viewChapter').innerHTML = `
      <nav class="crumb">
        <button class="lnk" data-nav="toc">${p.icon} ${esc(p.name)}</button>
        <span class="sep">/</span><span class="cur-c">第 ${idx + 1} 章</span>
        <span class="pos">${idx + 1} / ${secs.length}</span>
      </nav>
      <header class="chap-head">
        <span class="chap-no">${esc(s.seq)}</span>
        <div class="chap-tt"><h1>${esc(s.title)}</h1><div class="it">${esc(s.titleIt || '')}</div></div>
      </header>
      <div class="chap-tools">
        <button class="btn-sm" data-playsec="${s.id}">▶ 连播本章</button>
        <button class="btn-sm" data-quiz="${s.id}">✅ 本章小测</button>
        <button class="btn-sm" data-fill="${s.id}">✏️ 本章填空</button>
        <button class="btn-sm" data-sim="${s.id}">🎭 本章情景模拟</button>
        <button class="btn-sm ${allFav ? 'on' : ''}" data-favsec="${s.id}">${allFav ? '★ 取消收藏本章' : '☆ 收藏本章'}</button>
        <span class="chap-stat">本章 <b>${items.length}</b> 条 · 已掌握 <b>${master}</b> · 收藏 <b>${favN}</b></span>
      </div>
      ${s.tip ? `<div class="sec-tip">💡 ${esc(s.tip)}</div>` : ''}
      ${(s.notes && s.notes.length) ? `<details class="sec-notes"><summary>💡 补充提示（${s.notes.length} 条）</summary><ul>${s.notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}
      <div class="chap-body">${body}</div>
      <nav class="chap-nav">
        ${prev ? `<button class="cnav-btn" data-chap="${prev.id}"><span>← 上一章</span><b>${esc(prev.seq)} ${esc(prev.title)}</b></button>` : '<span class="cnav-btn off"></span>'}
        <button class="cnav-btn mid" data-nav="toc">☰ 目录</button>
        ${next ? `<button class="cnav-btn" data-chap="${next.id}"><span>下一章 →</span><b>${esc(next.seq)} ${esc(next.title)}</b></button>` : '<span class="cnav-btn off"></span>'}
      </nav>`;

    showView('chap');
    renderStarButtons('');
    renderMarkButtonsAll();
  }

  function renderItems(s) {
    let html = '<div class="rows">';
    s.items.forEach((it) => {
      if (it.t === 'd') { html += renderDialogue(it, s); }
      else if (it.t === 'phone') {
        html += `<div class="phone" data-id="${it.id}"><span class="num txt" data-t="it" title="点击听意语">${esc(it.num)}</span><span class="use txt" data-t="zh" title="点击听中文">${esc(it.zh || '')}</span>
          <span style="margin-left:auto" class="acts"><button class="mini-btn b-fav" data-id="${it.id}" title="收藏">☆</button>
          <button class="mini-btn b-mark" data-id="${it.id}" data-m="${markOf(it.id)}" title="掌握度">${markLabel(markOf(it.id))}</button></span></div>`;
      } else {
        const sp = it.sp ? `<span class="spbadge ${it.sp === '客' || it.sp === 'B' ? 'b' : 'k'}">${esc(it.sp)}</span>` : '';
        html += `<div class="row" data-id="${it.id}">
          <div class="it txt" data-t="it" title="点击听意语">${sp}${esc(it.it)}</div>
          <div class="zh txt" data-t="zh" title="点击听中文">${esc(it.zh || '')}${it.note ? `<span class="note">${esc(it.note)}</span>` : ''}</div>
          <div class="acts">
            <button class="mini-btn b-fav" data-id="${it.id}" title="收藏">☆</button>
            <button class="mini-btn b-mark" data-id="${it.id}" data-m="${markOf(it.id)}" title="掌握度">${markLabel(markOf(it.id))}</button>
          </div></div>`;
      }
    });
    return html + '</div>';
  }

  function renderDialogue(d, s) {
    let h = '<div class="dialog">';
    if (d.sum) h += `<div class="dsum">${esc(d.sum)}</div>`;
    if (d.scene) h += `<div class="dscene">🎬 ${esc(d.scene)}</div>`;
    d.lines.forEach((ln) => {
      const who = (ln.who === 'A' || ln.who === 'B') ? ln.who : esc(ln.who);
      const sideB = ln.who === 'B' || ln.side === 'b';
      h += `<div class="dline ${sideB ? 'b' : ''}" data-id="${ln.id}">
        <span class="who">${esc(who)}</span>
        <div class="bub"><div class="it txt" data-t="it" title="点击听意语">${esc(ln.it)}</div>${ln.zh ? `<div class="zh txt" data-t="zh" title="点击听中文">${esc(ln.zh)}</div>` : ''}</div>
        <span class="acts"><button class="mini-btn b-fav" data-id="${ln.id}">☆</button>
        <button class="mini-btn b-mark" data-id="${ln.id}" data-m="${markOf(ln.id)}">${markLabel(markOf(ln.id))}</button></span>
      </div>`;
    });
    return h + '</div>';
  }

  function renderGrammar(s) {
    let h = '<div class="grammar">';
    s.blocks.forEach((b) => {
      h += `<div class="gblock"><div class="gh"><b>${esc(b.zh.replace(/^[·\s]*/, ''))}</b><span class="rule">${esc(b.it)}</span></div>
        <div class="gtxt">${esc(b.zh)}</div><div class="exs">`;
      b.ex.forEach((e) => {
        h += `<div class="ex" data-id="${e.id}"><div class="eit txt" data-t="it" title="点击听意语">${esc(e.it)}</div><div class="ezh txt" data-t="zh" title="点击听中文">${esc(e.zh)}</div>
        <span class="acts"><button class="mini-btn b-fav" data-id="${e.id}">☆</button>
        <button class="mini-btn b-mark" data-id="${e.id}" data-m="${markOf(e.id)}">${markLabel(markOf(e.id))}</button></span></div>`;
      });
      h += '</div></div>';
    });
    return h + '</div>';
  }

  /* ---------------- 整章收藏 ---------------- */
  function toggleSecFav(secId) {
    const items = SECITEM[secId] || [];
    if (!items.length) return;
    const allFav = items.every((a) => isFav(a.id));
    items.forEach((a) => { if (allFav) delete ST.favs[a.id]; else ST.favs[a.id] = 1; });
    save(); renderFavCount(); renderStarButtons(''); renderFavList(); syncSecFavBtn();
    const s = sectionById(cur.profId, secId);
    if (s && cur.secId === secId) renderChapterView(s);
    toast((allFav ? '已取消收藏本章 ' : '已收藏本章 ') + items.length + ' 条');
  }
  function syncSecFavBtn() {
    const b = $('#viewChapter [data-favsec]');
    if (!b) return;
    const items = SECITEM[b.dataset.favsec] || [];
    const all = items.length > 0 && items.every((a) => isFav(a.id));
    b.classList.toggle('on', all);
    b.textContent = all ? '★ 取消收藏本章' : '☆ 收藏本章';
  }

  /* ---------------- 播放控制 ---------------- */
  // 点读：按语言单独播放（意语 / 中文）。点击文字即触发。
  function playText(id, lang) {
    const a = IDX[id]; if (!a) return;
    touchDay();
    const item = a.item;
    const isZh = lang === 'zh';
    const audio = isZh ? (item.audioZh || '') : (item.audio || '');
    let text;
    if (item.t === 'phone') text = isZh ? (item.zh || '') : ('Numero ' + (item.num || ''));
    else text = isZh ? (item.zh || item.num || '') : (item.it || '');
    if (!text) return;
    if (!audio) { speakFallback(text, lang); markCur(id, lang); return; }
    Player.playOne(playable(text, audio, lang, text, null, (a.prof.name + ' · ' + a.sec.title), id, a.sec.id));
  }

  // 缺音频时（理论上不会）也高亮一下对应文字
  function markCur(id, lang) {
    const el = $('#main [data-id="' + id + '"]');
    if (!el) return;
    const t = el.querySelector('.txt[data-t="' + (lang || 'it') + '"]') || el;
    $$('.cur').forEach((e) => e.classList.remove('cur'));
    t.classList.add('cur');
    setTimeout(() => t.classList.remove('cur'), 1600);
  }

  function playItem(id) {
    const a = IDX[id]; if (!a) return;
    touchDay();
    const label = a.item.it || a.item.num || '';
    // 不缓存 el：连播时会自动翻章，元素要按 id 现查（Player.step 里处理）
    Player.playOne(playable(label, a.item.audio, 'it', label, null, (a.prof.name + ' · ' + a.sec.title), id, a.sec.id));
  }

  // 连播：每条先念意语、再念中文（没有中文的条只念意语）
  function playSection(secId) {
    const p = curProf();
    const secs = openSections(p);
    const list = [];
    secs.forEach((s) => {
      if (secId && s.id !== secId) return;
      s.items.forEach((it) => {
        if (it.t === 'd') {
          it.lines.forEach((ln) => {
            if (ln.it) list.push(playable(ln.it, ln.audio, 'it', ln.it, null, s.title + ' · ' + ln.who, ln.id, s.id));
            if (ln.zh && ln.audioZh) list.push(playable(ln.zh, ln.audioZh, 'zh', ln.zh, null, s.title + ' · ' + ln.who, ln.id, s.id));
          });
        } else if (it.t === 'phone') {
          list.push(playable('Numero ' + it.num, it.audio, 'it', it.num, null, s.title, it.id, s.id));
          if (it.zh && it.audioZh) list.push(playable(it.zh, it.audioZh, 'zh', it.zh, null, s.title, it.id, s.id));
        } else {
          if (it.it) list.push(playable(it.it, it.audio, 'it', it.it, null, s.title + (it.zh ? ' — ' + it.zh : ''), it.id, s.id));
          if (it.zh && it.audioZh) list.push(playable(it.zh, it.audioZh, 'zh', it.zh, null, s.title, it.id, s.id));
        }
      });
      if (s.blocks) s.blocks.forEach((b) => b.ex.forEach((e) => {
        if (e.it) list.push(playable(e.it, e.audio, 'it', e.it, null, '语法例句', e.id, s.id));
        if (e.zh && e.audioZh) list.push(playable(e.zh, e.audioZh, 'zh', e.zh, null, '语法例句', e.id, s.id));
      }));
    });
    if (!list.length) { toast('本章还没有可播放的内容'); return; }
    Player.setList(list); Player.start();
  }

  /* ---------------- 收藏按钮状态 ---------------- */
  function renderStarButtons(id) {
    if (id) {
      const on = isFav(id);
      $$('.b-fav[data-id="' + id + '"]').forEach((b) => { b.textContent = on ? '★' : '☆'; b.style.color = on ? 'var(--gold)' : ''; });
      return;
    }
    $$('#main .b-fav, #favList .b-unfav').forEach((b) => {
      const on = isFav(b.dataset.id);
      if (b.classList.contains('b-fav')) { b.textContent = on ? '★' : '☆'; b.style.color = on ? 'var(--gold)' : ''; }
    });
  }
  function renderMarkButtons(id) {
    $$('.b-mark[data-id="' + id + '"]').forEach((b) => {
      const m = markOf(id);
      b.textContent = markLabel(m); b.dataset.m = m;
      b.style.color = m === 2 ? 'var(--brand)' : m === 1 ? 'var(--gold)' : '';
    });
  }
  function renderMarkButtonsAll() { $$('#main .b-mark').forEach((b) => renderMarkButtons(b.dataset.id)); }

  /* ---------------- 搜索 ---------------- */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function openSearch(q) {
    $('#searchModal').hidden = false;
    $('#searchModalInput').value = q || '';
    doSearch(q || '');
    setTimeout(() => $('#searchModalInput').focus(), 30);
  }
  function doSearch(q) {
    const box = $('#searchResults');
    const query = norm(q.trim());
    if (!query) { box.innerHTML = '<p class="empty">输入关键词开始搜索：如 conto / 账单 / prenotare / 辣</p>'; return; }
    const hits = ALL.filter((a) => norm(a.item.it).indexOf(query) >= 0 || norm(a.item.zh || '').indexOf(query) >= 0 || norm(a.item.note || '').indexOf(query) >= 0).slice(0, 80);
    if (!hits.length) { box.innerHTML = '<p class="empty">没有找到「' + esc(q) + '」相关内容</p>'; return; }
    box.innerHTML = hits.map((a) => {
      const it = a.item.it || a.item.num || '';
      const zh = a.item.zh || '';
      return `<div class="srow" data-id="${a.id}">
        <div style="min-width:0;flex:1">
          <div class="it txt" data-t="it" title="点击听意语">${hl(it, q)}</div>
          <div class="zh txt" data-t="zh" title="点击听中文">${zh ? hl(zh, q) : ''}${a.item.note ? ' <span style="color:var(--muted)">' + hl(a.item.note, q) + '</span>' : ''}</div>
          <div class="path">${esc(a.prof.name)} · ${esc(a.sec.title)}</div>
        </div></div>`;
    }).join('');
    // 结果行的点击（含 🔊）走全局委托
  }
  function hl(text, q) {
    const t = esc(text);
    if (!q) return t;
    const i = norm(text).indexOf(norm(q));
    if (i < 0) return t;
    const a = text.substring(0, i), b = text.substr(i, q.length), c = text.substring(i + q.length);
    return esc(a) + '<mark>' + esc(b) + '</mark>' + esc(c);
  }
  // 搜索 / 收藏点进去：跳到该条目所在的单章页，高亮 + 朗读
  function gotoItem(id) {
    const a = IDX[id]; if (!a) return;
    cur.profId = a.prof.id; cur.home = false;
    openChapter(a.sec.id, true);
    applyHash();
    setTimeout(() => {
      const el = $('#main [data-id="' + id + '"]');
      if (el) {
        const t = el.querySelector('.txt[data-t="it"]') || el;
        t.classList.add('cur');
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => t.classList.remove('cur'), 1800);
      }
      playItem(id);
    }, 80);
  }

  /* ---------------- toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#1C2530;color:#fff;padding:9px 16px;border-radius:999px;font-size:13px;z-index:120;opacity:0;transition:.2s;pointer-events:none;max-width:90vw;text-align:center'; document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.style.opacity = '0'), 2200);
  }

  /* ---------------- 抽屉 ---------------- */
  function openDrawer() { $('#sidebar').classList.add('open'); $('#drawerMask').classList.add('show'); }
  function closeDrawer() { $('#sidebar').classList.remove('open'); $('#drawerMask').classList.remove('show'); }

  /* ---------------- 事件绑定 ---------------- */
  function openStudy() {
    if (window.Study) window.Study.open();
    else if (window.IT && window.IT.openStudy) window.IT.openStudy();
    else toast('学习面板还没准备好，刷新页面再试');
  }
  function bind() {
    $('#btnDrawer').addEventListener('click', openDrawer);
    $('#drawerMask').addEventListener('click', closeDrawer);
    $('#searchInput').addEventListener('focus', () => openSearch($('#searchInput').value));
    $('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { $('#searchModal').hidden = true; gotoItem(e.target.dataset.pick || ''); } if (e.key === 'Escape') $('#searchModal').hidden = true; });
    $('#btnSearchClose').addEventListener('click', () => { $('#searchModal').hidden = true; });
    $('#searchModalInput').addEventListener('input', (e) => doSearch(e.target.value));
    $('#searchModal').addEventListener('click', (e) => { if (e.target.id === 'searchModal') $('#searchModal').hidden = true; });
    $('#btnFavTop').addEventListener('click', () => goHome(true));
    $('#btnTheme').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next; ST.theme = next; save();
    });
    $('#btnStudyTop').addEventListener('click', () => openStudy());
    $('#btnStart').addEventListener('click', () => gotoProf(READY[0].id));
    $('#btnQuickPlay').addEventListener('click', () => {
      // 按「当前职业的目录顺序前 3 章」取推荐句，两个职业通用
      const pid = curProf().id;
      const picks = ALL.filter((a) => a.item.it && a.prof.id === pid && a.sec.seq <= 3).slice(0, 10);
      Player.setList(picks.map((a) => playable(a.item.it, a.item.audio, a.item.it, null, a.sec.title + ' · ' + a.prof.name, a.id, a.sec.id)));
      Player.start();
    });

    // 播放器
    $('#plToggle').addEventListener('click', () => Player.toggle());
    $('#plNext').addEventListener('click', () => Player.next());
    $('#plPrev').addEventListener('click', () => Player.prev());
    $('#plStop').addEventListener('click', () => Player.stop());
    $('#plLoop').addEventListener('change', (e) => (Player.loop = e.target.checked));

    // 章节工具按钮 / 词条按钮都走 bindViewEvents 的全局委托，这里只管非委托类交互

    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(''); return; }
      if (e.key === 'Escape') { $('#searchModal').hidden = true; $('#studyModal').hidden = true; return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); chapterStep(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); chapterStep(-1); }
    });

    // 语音列表（Chrome 需要异步）
    if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (x) { } }
  }

  /* ---------------- 启动 ---------------- */
  function routeFromHash() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    const p = parts.length ? PROF[parts[0]] : null;
    if (!p || p.status !== 'ready') { goHome(); return; }
    cur.profId = p.id; cur.home = false;
    if (parts[1] && sectionById(p.id, parts[1])) openChapter(parts[1]);
    else gotoProf(p.id);
  }

  function init() {
    document.documentElement.dataset.theme = ST.theme || 'light';
    bind();
    bindViewEvents();
    renderProfNav();
    updateProgress();
    renderFavCount();
    const last = ST.lastProf && PROF[ST.lastProf] && PROF[ST.lastProf].status === 'ready' ? ST.lastProf : 'ristorante';
    if (location.hash && location.hash !== '#/') routeFromHash();          // 直接打开 #/ristorante/s03 也能定位
    else if (ST.days && Object.keys(ST.days).length) gotoProf(last);       // 有学习记录 → 回到上次的职业
    else goHome();
    lastHash = hashOf();
  }
  // 浏览器前进/后退：hash 与我们自己写的不一致才重新路由
  window.addEventListener('hashchange', () => { if (location.hash !== lastHash) routeFromHash(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  /* 对外暴露 */
  window.IT = {
    DB, ALL, ST, save, markOf, setMark, isFav, toggleFav, IDX, cur,
    playSection, playItem, openStudy: () => window.Study && window.Study.open(),
    player: Player, audioEl: Audio1, curProf, openSections, esc, toast,
    gotoProf, openChapter, gotoItem,
    // 学习面板开着时不做重绘：既省性能，也不会把面板背后的 DOM 换掉导致交互断线
    refresh: () => {
      if (!$('#studyModal').hidden) return;
      renderChapterNav();
      if (cur.home) renderHome();
      else if (cur.secId) renderChapterView(sectionById(cur.profId, cur.secId));
      else renderProfView();
    }
  };
})();
