/* ==========================================================
   学习模块：词汇卡片 / 选择题 / 填空题 / 情景模拟 / 学习统计
   ========================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IT = window.IT;
  const ITAPI = () => window.IT;
  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  let scope = { profId: 'ristorante', secId: null }; // secId null = 全部章节
  let tab = 'cards';

  /* ---------------- 取当前范围内容 ---------------- */
  function itemsOf() {
    const API = window.IT;
    const p = API.DB.professions.find((x) => x.id === scope.profId);
    const list = [];
    p.sections.forEach((s) => {
      if (scope.secId && s.id !== scope.secId) return;
      if (s.blocks) {
        s.blocks.forEach((b) => b.ex.forEach((e) => list.push({ id: e.id, it: e.it, zh: e.zh, note: '', audio: e.audio })));
      }
      s.items.forEach((it) => {
        if (it.t === 'd') it.lines.forEach((ln) => list.push({ id: ln.id, it: ln.it, zh: ln.zh || '', note: '', audio: ln.audio, who: ln.who }));
        else if (it.t === 'phone') list.push({ id: it.id, it: 'Numero ' + it.num, zh: it.zh, note: '', audio: it.audio });
        else list.push({ id: it.id, it: it.it, zh: it.zh || '', note: it.note || '', audio: it.audio, sp: it.sp });
      });
    });
    return list;
  }
  function scopeName() {
    const API = window.IT;
    const p = API.DB.professions.find((x) => x.id === scope.profId);
    if (!scope.secId) return p.name + ' · 全部章节';
    const s = p.sections.find((x) => x.id === scope.secId);
    return p.name + ' · ' + s.title;
  }

  /* 练习里的文本 → edge-tts 音频索引。
     选项/答案都是已经配过音的词条，直接复用现成 mp3 —— 练到哪一句，
     听到的都是同一个女声（it-IT-IsabellaNeural），不会再掉到浏览器 TTS。 */
  function textAudioIndex() {
    const ix = Object.create(null);
    itemsOf().forEach((x) => {
      if (!x.it || !x.audio) return;
      const k = norm(x.it);
      if (!(k in ix)) ix[k] = x.audio;
    });
    return ix;
  }
  // 只收「本身就是一个词」的词条（填空题挖空的词，用它单独发声）
  function wordAudioIndex() {
    const ix = Object.create(null);
    itemsOf().forEach((x) => {
      if (!x.it || !x.audio) return;
      const w = norm(x.it.replace(/[^\p{L}\p{N}']+/gu, ' '));
      if (!w || /\s/.test(w)) return;
      if (!(w in ix)) ix[w] = x.audio;
    });
    return ix;
  }

  let playTimer = null;
  // 正在发声的按钮脉冲提示（练面板盖在页面之上，底部播放器看不到）
  function markPlaying(btn, text) {
    $$('.is-playing').forEach((e) => e.classList.remove('is-playing'));
    clearTimeout(playTimer);
    if (!btn) return;
    btn.classList.add('is-playing');
    const clear = () => btn.classList.remove('is-playing');
    const el = window.IT.audioEl;
    if (el) el.addEventListener('ended', clear, { once: true });
    playTimer = setTimeout(clear, Math.max(1800, String(text || '').length * 130));
  }

  function playAudio(item, btn) {
    const API = window.IT;
    API.player.playOne({
      text: item.it, audio: item.audio, title: item.it, el: null,
      sub: scopeName(), id: '', secId: ''
    });
    markPlaying(btn, item.it);
  }

  /* ---------------- 弹层与 tab ---------------- */
  function open(tabName) {
    const API = window.IT;
    const pid = (API.curProf && API.curProf().id) || scope.profId;
    if (pid !== scope.profId) { scope.profId = pid; scope.secId = null; }  // 换职业时清掉上一职业的章范围
    tab = tabName || 'cards';
    renderScopeSelect();
    $('#studyModal').hidden = false;
    $$('#studyTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    enter(tab);
  }
  function close() { $('#studyModal').hidden = true; }

  function renderScopeSelect() {
    const API = window.IT;
    const p = API.DB.professions.find((x) => x.id === scope.profId);
    const sel = $('#studyScope');
    sel.innerHTML = `<option value="">${esc(p.name)} · 全部章节</option>` +
      p.sections.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join('');
    sel.value = scope.secId || '';
  }

  function renderTabs() {
    $$('#studyTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  }

  /* ---------------- 主入口 ---------------- */
  function enter(t) {
    tab = t; renderTabs();
    // 先掐掉上一个模块的残留声音，再渲染新模块 —— 顺序反了会把新模块刚触发的自动读音一起停掉
    window.IT.player.stop();
    const body = $('#studyBody');
    if (t === 'cards') { body.innerHTML = htmlCards(); bindCards(); }
    else if (t === 'quiz') { body.innerHTML = htmlQuiz(); newQuiz(); bindQuiz(); }
    else if (t === 'fill') { body.innerHTML = htmlFill(); newFill(); bindFill(); }
    else if (t === 'sim') { body.innerHTML = htmlSim(); newSim(); bindSim(); }
    else if (t === 'stats') { body.innerHTML = htmlStats(); bindStats(); }
  }

  /* =============== 1. 词汇卡片 ================= */
  let C = { list: [], i: 0, res: [], flip: false, auto: true };

  function htmlCards() {
    return `<div class="study-head">
      <b>词汇卡片</b><span class="p">点击卡片翻面看中文 · 用 ○ ◐ ● 标记掌握度</span>
      <span class="grow"></span>
      <button class="btn-sm" id="cShuffle">🔀 打乱</button>
      <button class="btn-sm" id="cAuto">🔊 自动读音：开</button>
      <button class="btn-sm" id="cFavOnly">☆ 只看收藏</button>
    </div><div id="cArea"></div><div id="cDots" class="dots"></div><div id="cCtrl" class="study-head ctrl-row"></div>`;
  }

  function buildCards() {
    let list = itemsOf();
    if (C.favOnly) list = list.filter((x) => window.IT.isFav(x.id));
    list = shuffle(list);
    C.list = list.slice(0, Math.min(list.length, 60));
    C.i = 0; C.res = C.list.map(() => 0); C.flip = false;
    drawCard(); drawDots();
  }
  function drawDots() {
    const d = $('#cDots'); if (!d) return;
    d.innerHTML = C.list.map((x, i) => `<span class="dot ${C.res[i] === 2 ? 'ok' : C.res[i] === 1 ? 'no' : ''} ${i === C.i ? 'cur' : ''}"></span>`).join('') || '<span class="p">无卡片</span>';
  }
  function drawCard() {
    const it = C.list[C.i];
    const area = $('#cArea');
    if (!area) return;
    if (!it) { area.innerHTML = '<p class="empty">这一范围没有可练习的卡片</p>'; return; }
    if (C.flip) {
      area.innerHTML = `<div class="flashcard" id="fcard">
        <div class="f-it">${esc(it.who ? '[' + esc(it.who) + '] ' : '')}${esc(it.it)}</div>
        <div class="f-zh">${esc(it.zh || '—')}</div>
        ${it.note ? `<div class="f-note">${esc(it.note)}</div>` : ''}
        <div class="f-hint">${esc(it.zh ? '意 → 中' : '中 → 意')} · 点击返回意文</div></div>`;
    } else {
      area.innerHTML = `<div class="flashcard" id="fcard">
        ${it.zh ? `<div class="f-zh" style="font-size:19px;color:var(--muted);margin-bottom:10px">${esc(it.zh)}</div>` : ''}
        <div class="f-it">${esc(it.who ? '[' + esc(it.who) + '] ' : '')}${esc(it.it)}</div>
        <div class="f-hint">点击卡片 / 按空格看中文</div></div>`;
    }
    const cur = C.list[C.i];
    const m = window.IT.markOf(cur.id);
    $('#cCtrl').innerHTML =
      `<button class="btn-sm" data-mv="-1">← 上一张</button>
       <button class="btn-sm" data-mv="1">下一张 →</button>
       <button class="btn-sm" data-play="1">🔊 听</button>
       <button class="btn-sm" data-fav="1">${window.IT.isFav(cur.id) ? '★ 取消收藏' : '☆ 收藏'}</button>
       <button class="btn-sm" data-mark="${m}">掌握度：${['○ 未学', '◐ 学习中', '● 已掌握'][m]}</button>
       <span class="p" style="margin-left:6px">第 ${C.i + 1}/${C.list.length} 张 · 已掌握 ${C.res.filter((x) => x === 2).length} · 学习中 ${C.res.filter((x) => x === 1).length}</span>`;
    if (C.auto && !C.flip) playAudio(cur, $('#cArea .flashcard'));
  }
  function bindCards() {
    $('#cArea').addEventListener('click', (e) => { if (e.target.closest('#fcard')) { C.flip = !C.flip; drawCard(); } });
    const ctrl = $('#cCtrl');
    if (ctrl) ctrl.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mv) { C.i = (C.i + (+b.dataset.mv) + C.list.length) % C.list.length; C.flip = false; drawCard(); drawDots(); }
      if (b.dataset.play) playAudio(C.list[C.i], b);
      if (b.dataset.fav) { window.IT.toggleFav(C.list[C.i].id); drawCard(); }
      if (b.dataset.mark !== undefined) { window.IT.setMark(C.list[C.i].id, (+b.dataset.mark + 1) % 3); drawCard(); }
    });
    $('#cShuffle').addEventListener('click', buildCards);
    $('#cFavOnly').addEventListener('click', (e) => { C.favOnly = !C.favOnly; e.target.textContent = C.favOnly ? '☆ 看全部' : '☆ 只看收藏'; buildCards(); });
    $('#cAuto').addEventListener('click', (e) => { C.auto = !C.auto; e.target.textContent = '🔊 自动读音：' + (C.auto ? '开' : '关'); });
    if (!C.list.length || C.shown !== true) { C.shown = true; buildCards(); }
  }

  /* =============== 2. 选择题 ================= */
  let Q = { qs: [], i: 0, picked: -1, done: false };

  function htmlQuiz() {
    return `<div class="study-head"><b>选择题</b><span class="p">意↔中互译，从当前范围抽 10 题 · 答完后点选项可重听</span>
      <span class="grow"></span><button class="btn-sm" id="qNew">🔄 换一批</button></div><div id="qArea"></div>`;
  }
  function newQuiz() {
    const list = itemsOf().filter((x) => x.it && x.zh);
    const pool = shuffle(list);
    const aud = textAudioIndex();
    const qs = [];
    const zhPool = shuffle(list.map((x) => x.zh));
    const itPool = shuffle(list.map((x) => x.it));
    // 抽干扰项：章节很小时（可选词少于 4 个）不能无限抽，抽不到就允许重复兜底
    const pickWrong = (src, avoid) => {
      const out = [], seen = Object.create(null);
      seen[avoid] = 1;
      let guard = 0;
      while (out.length < 3 && guard++ < 80) { const w = rand(src); if (!seen[w]) { seen[w] = 1; out.push(w); } }
      let k = 0;
      while (out.length < 3 && src.length) out.push(src[k++ % src.length]);
      return out;
    };
    for (let n = 0; n < Math.min(10, pool.length); n++) {
      const a = pool[n];
      const toZh = n % 2 === 0;
      let opts;
      if (toZh) {
        opts = shuffle([a.zh].concat(pickWrong(zhPool, a.zh)));
        qs.push({ q: a.it, tip: '选出中文意思', ans: a.zh, opts: opts, optA: opts.map(() => ''), item: a, toZh: true });
      } else {
        opts = shuffle([a.it].concat(pickWrong(itPool, a.it)));
        qs.push({ q: a.zh, tip: '选出意大利语说法', ans: a.it, opts: opts, optA: opts.map((o) => aud[norm(o)] || ''), item: a, toZh: false });
      }
    }
    Q.qs = qs; Q.i = 0; Q.picked = -1; Q.done = false;
    drawQuiz();
  }
  function drawQuiz() {
    const area = $('#qArea');
    if (!area) return;
    if (!Q.qs.length) { area.innerHTML = '<p class="empty">当前范围题目不足</p>'; return; }
    const q = Q.qs[Q.i];
    const keys = ['A', 'B', 'C', 'D'];
    area.innerHTML = `<div class="qwrap">
      <div class="qtitle">第 ${Q.i + 1}/${Q.qs.length} 题 · ${esc(q.tip)}</div>
      <div class="${q.toZh ? 'q-zh' : 'q-it'}">${esc(q.q)}</div>
      <div class="opts" id="qOpts">${q.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${keys[i]}</span><span class="etxt">${esc(o)}</span></button>`).join('')}</div>
      <div class="study-head" style="margin-top:14px">
        <button class="btn-sm" id="qPlay">🔊 听发音</button>
        <span class="p" id="qMsg"></span>
      </div>
      <div class="study-head" id="qNextWrap" style="display:none"><button class="btn-sm" id="qNext">下一题 →</button></div>
    </div>`;
    // 题干本身就是意语（意→中）时自动朗读，边听边选
    if (q.toZh) playAudio(q.item, $('#qPlay'));
    $$('#qOpts .opt').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (Q.picked >= 0) {                     // 已作答：再点选项 = 重听这一项（意语选项才有音）
        if (q.optA[i]) playAudio({ it: q.opts[i], audio: q.optA[i] }, b);
        return;
      }
      Q.picked = i;
      const right = q.opts[i] === q.ans;
      b.classList.add(right ? 'right' : 'wrong');
      if (!right) $$('#qOpts .opt').forEach((o) => { if (o.querySelector('.etxt').textContent === q.ans) o.classList.add('right'); });
      $('#qMsg').textContent = right ? '✅ 正确' : ('❌ 正确答案：' + q.ans);
      $('#qNextWrap').style.display = '';
      window.IT.ST.quiz.n++; if (right) window.IT.ST.quiz.ok++;
      window.IT.save();
      if (right) window.IT.setMark(q.item.id, 2); else window.IT.setMark(q.item.id, 1);
      // 无论对错都念正确的意语句（edge-tts mp3），并让正确选项闪一下
      const rightBtn = $$('#qOpts .opt')[q.opts.indexOf(q.ans)];
      playAudio(q.item, rightBtn || $('#qPlay'));
      window.IT.refresh();
    }));
    $('#qPlay').addEventListener('click', () => playAudio(q.item, $('#qPlay')));
    $('#qNext').addEventListener('click', () => {
      Q.i++; Q.picked = -1;
      if (Q.i >= Q.qs.length) {
        const ok = Q.qs.reduce((n, _q, i) => n + 1, 0); // 占位
        $('#qArea').innerHTML = `<div class="qwrap"><h3 style="font-size:18px;margin-bottom:8px">本轮结束</h3>
          <p class="p">已记录你的选择与掌握状态，连续学习已 +1 天。</p>
          <div class="study-head" style="margin-top:12px"><button class="btn-sm" id="qAgain">🔄 再来一轮</button><button class="btn-sm" id="qBack">← 返回卡片</button></div></div>`;
        $('#qAgain').addEventListener('click', newQuiz);
        $('#qBack').addEventListener('click', () => enter('cards'));
        window.IT.refresh();
        return;
      }
      drawQuiz();
    });
  }
  function bindQuiz() { $('#qNew').addEventListener('click', newQuiz); }

  /* =============== 3. 填空题 ================= */
  let F = { qs: [], i: 0, done: false };

  function htmlFill() {
    return `<div class="study-head"><b>填空题</b><span class="p">句子中挖掉一个关键词，写出它（不区分大小写与重音）</span>
      <span class="grow"></span><button class="btn-sm" id="fNew">🔄 换一批</button></div><div id="fArea"></div>`;
  }
  function tokens(s) { return String(s).split(/([ ,.'!?;:()«»\-–”—])/); }
  function buildWords(list) {
    const w = {};
    list.forEach((x) => {
      if (!x.it) return;
      const parts = tokens(x.it).map((t) => t.trim().toLowerCase().replace(/^\p{L}+$/u, ''));
      tokens(x.it).forEach((t) => { const c = t.trim().toLowerCase(); if (c.length >= 4 && /^[a-zà-ÿäöü']+$/.test(c) && !['percante', 'questo', 'questa', 'quale', 'perch', 'della', 'delle', 'sono', 'tutti', 'quando'].includes(c.slice(0, 8))) w[c] = x.zh || ''; });
    });
    return w;
  }
  function newFill() {
    const list = itemsOf().filter((x) => x.it && x.it.length > 12);
    const words = buildWords(list);
    const wIx = wordAudioIndex();
    const qs = [];
    shuffle(list).slice(0, 30).forEach((x) => {
      if (qs.length >= 10) return;
      const parts = tokens(x.it);
      const cand = [];
      parts.forEach((p, i) => {
        const c = p.trim().toLowerCase().replace(/[^a-zà-ÿ']/g, '');
        if (c.length >= 4 && words[c] && cand.length < 3) cand.push({ i: i, w: c });
      });
      if (!cand.length) return;
      const pick = cand[0];
      const blank = '____';
      const parts2 = parts.slice();
      parts2[pick.i] = blank;
      qs.push({
        q: parts2.join(''), answer: pick.w, item: x,
        hint: words[pick.w] || '', audio: x.audio,
        answerAudio: wIx[pick.w.toLowerCase()] || ''   // 答案是独立词条时，用它的 edge-tts 音频单独念
      });
    });
    F.qs = qs; F.i = 0; F.done = false; drawFill();
  }
  function drawFill() {
    const area = $('#fArea');
    if (!area) return;
    if (!F.qs.length) { area.innerHTML = '<p class="empty">这个范围还没有适合挖空的句子，换一个章节试试</p>'; return; }
    const q = F.qs[F.i];
    area.innerHTML = `<div class="qwrap">
      <div class="qtitle">第 ${F.i + 1}/${F.qs.length} 题 · 填入正确的词（首字母提示：${q.answer[0]}…${q.answer.length} 个字母${q.hint ? ' · 意思：' + esc(q.hint) : ''}）</div>
      <div class="q-it">${esc(q.q)}</div>
      <div class="fillbox">
        <input id="fillInput" placeholder="在这里输入意大利语单词" autocomplete="off" spellcheck="false">
        <button class="btn primary" id="fillOk">提交</button>
      </div>
      <div class="fill-msg" id="fillMsg"></div>
      <div class="study-head" style="margin-top:8px"><button class="btn-sm" id="fillPlay">🔊 听整句</button><button class="btn-sm" id="fillShow">看答案</button><span class="p" id="fillScore"></span></div>
    </div>`;
    const inp = $('#fillInput');
    setTimeout(() => inp.focus(), 20);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFill(); });
    $('#fillOk').addEventListener('click', submitFill);
    // 提交/看答案时念「答案词」；想听整句点「🔊 听整句」——都用 edge-tts 女声 mp3
    const playAnswer = (btn) => playAudio({ it: q.answer, audio: q.answerAudio || q.item.audio }, btn);
    $('#fillShow').addEventListener('click', () => { $('#fillMsg').textContent = '答案：' + q.answer; playAnswer($('#fillShow')); });
    $('#fillPlay').addEventListener('click', () => playAudio(q.item, $('#fillPlay')));
    function submitFill() {
      const v = inp.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const a = q.answer.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ok = v.replace(/[^a-z]/g, '') === a.replace(/[^a-z]/g, '');
      const msg = $('#fillMsg');
      msg.className = 'fill-msg ' + (ok ? 'ok' : 'no');
      msg.textContent = ok ? '✅ 正确！' : ('❌ 不对，正确答案是：' + q.answer + (q.hint ? '（' + q.hint + '）' : ''));
      window.IT.ST.fill.n++; if (ok) window.IT.ST.fill.ok++;
      window.IT.save();
      window.IT.setMark(q.item.id, ok ? 2 : 1);
      playAnswer($('#fillOk'));
      window.IT.refresh();
      if (F.i === F.qs.length - 1) {
        $('#fillScore').textContent = '本轮 ' + (F.qs.length) + ' 题已完成，最高可看统计页';
        $('#fillInput').disabled = true; $('#fillOk').disabled = true;
      } else { setTimeout(() => { F.i++; drawFill(); }, 700); }
    }
  }
  function bindFill() { $('#fNew').addEventListener('click', newFill); }

  /* =============== 4. 情景模拟 ================= */
  let S = { qs: [], i: 0, picked: -1 };

  function htmlSim() {
    return `<div class="study-head"><b>情景模拟</b><span class="p">先听对方（A）说，再选出你（B）最合适的回应 · 答完会念正确答句</span>
      <span class="grow"></span><button class="btn-sm" id="sNew">🔄 换一批</button></div><div id="sArea"></div>`;
  }
  function newSim() {
    const p = window.IT.DB.professions.find((x) => x.id === scope.profId);
    const dials = [];
    p.sections.forEach((s) => {
      if (scope.secId && s.id !== scope.secId) return;
      s.items.forEach((it) => { if (it.t === 'd') dials.push({ d: it, sec: s }); });
    });
    const allLines = [];
    p.sections.forEach((s) => s.items.forEach((it) => {
      if (it.t === 'd') it.lines.forEach((ln) => allLines.push({ it: ln.it, zh: ln.zh || '', audio: ln.audio || '', sec: s.title }));
    }));
    const aud = textAudioIndex();
    const pool = [];
    dials.forEach(({ d, sec }) => {
      for (let i = 0; i < d.lines.length - 1; i++) {
        const a = d.lines[i], b = d.lines[i + 1];
        if (!a.it || !b.it) continue;
        // 干扰项优先取「同段对话里的其他话」 + 「长度相近的其他场景台词」，逼你听懂而不是靠长度蒙
        const dialLns = d.lines.filter((l) => l.it && l.it !== b.it && l.it !== a.it);
        const near = (x) => Math.abs(x.it.length - b.it.length) < 30;
        const opts = [];
        const seen = {}; seen[b.it] = 1;
        shuffle(dialLns).forEach((c) => { if (near(c) && !seen[c.it]) { seen[c.it] = 1; opts.push(c.it); } });
        if (opts.length < 2) {
          shuffle(allLines.filter((x) => x.it !== b.it && x.it !== a.it && near(x)))
            .forEach((c) => { if (opts.length < 3 && !seen[c.it]) { seen[c.it] = 1; opts.push(c.it); } });
        }
        if (opts.length < 3) continue;
        const finalOpts = shuffle([b.it].concat(opts));
        pool.push({
          a: a.it, aZh: a.zh || '', aAudio: a.audio || '',
          ans: b.it, ansZh: b.zh || '', ansAudio: b.audio || '',
          opts: finalOpts, optA: finalOpts.map((o) => aud[norm(o)] || ''),
          sec: sec.title
        });
      }
    });
    S.qs = shuffle(pool).slice(0, 5); S.i = 0; S.picked = -1; drawSim();
  }
  function drawSim() {
    const area = $('#sArea');
    if (!area) return;
    if (!S.qs.length) { area.innerHTML = '<p class="empty">这个范围没有可用的情景对话，换一个章节试试</p>'; return; }
    const q = S.qs[S.i];
    area.innerHTML = `<div class="qwrap">
      <div class="qtitle">第 ${S.i + 1}/${S.qs.length} 题 · ${esc(q.sec)}</div>
      <div class="sim-stage">
        <div class="sim-line prompt"><span class="who" style="flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--brand-soft);color:var(--brand);border:1px solid color-mix(in srgb,var(--brand) 25%,transparent)">A</span>
          <div class="bub"><div class="it">${esc(q.a)}</div>${q.aZh ? `<div class="zh" id="sAZh" hidden>${esc(q.aZh)}</div>` : ''}</div>
          <button class="mini-btn b-play" id="sPlay" style="margin-left:auto">🔊</button>
        </div>
      </div>
      <div class="qtip" style="font-size:12.5px;color:var(--muted);margin-bottom:10px">
        ${q.aZh ? '<button class="btn-sm" id="sZh" style="margin-right:8px">👁 看中文</button>' : ''}轮到你（B）回答，选出最合适的回应：</div>
      <div class="opts" id="sOpts">${q.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">?</span><span class="etxt">${esc(o)}</span></button>`).join('')}</div>
      <div class="study-head" style="margin-top:14px"><span class="p" id="sMsg"></span></div>
    </div>`;
    $('#sPlay').addEventListener('click', () => playAudio({ it: q.a, audio: q.aAudio }, $('#sPlay')));
    // 中文默认藏着：这是听力题，先听再选；想看再点「👁 看中文」
    const zhBtn = $('#sZh');
    if (zhBtn) zhBtn.addEventListener('click', () => {
      const z = $('#sAZh'); if (!z) return;
      z.hidden = !z.hidden;
      zhBtn.textContent = z.hidden ? '👁 看中文' : '🙈 收起中文';
    });
    // 进入新题自动念对方的台词（edge-tts mp3），就是道听力题
    playAudio({ it: q.a, audio: q.aAudio }, $('#sPlay'));
    const keys = ['A', 'B', 'C', 'D'];
    $$('#sOpts .opt').forEach((b, i) => { $('.k', b).textContent = keys[i]; });
    $$('#sOpts .opt').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (S.picked >= 0) {                     // 已作答：再点选项 = 重听这一句
        if (q.optA[i]) playAudio({ it: q.opts[i], audio: q.optA[i] }, b);
        return;
      }
      S.picked = i;
      const right = q.opts[i] === q.ans;
      b.classList.add(right ? 'right' : 'wrong');
      if (!right) $$('#sOpts .opt').forEach((o) => { if (o.querySelector('.etxt').textContent === q.ans) o.classList.add('right'); });
      $('#sMsg').textContent = (right ? '✅ 说得漂亮！' : '❌ 换一种更好：') + (q.ansZh ? q.ansZh : '');
      window.IT.ST.sim.n++; if (right) window.IT.ST.sim.ok++;
      window.IT.save();
      // 念一遍该怎么回答（B 的台词，edge-tts mp3）；答完自动亮出 A 的中文，方便复盘
      const rightBtn = $$('#sOpts .opt')[q.opts.indexOf(q.ans)];
      playAudio({ it: q.ans, audio: q.ansAudio }, rightBtn || $('#sPlay'));
      const z = $('#sAZh');
      if (z) { z.hidden = false; if (zhBtn) zhBtn.textContent = '🙈 收起中文'; }
      window.IT.refresh();
      // 等正确答句念完再翻下一题，别把音频掐断
      setTimeout(() => {
        S.i++; S.picked = -1;
        if (S.i >= S.qs.length) {
          $('#sArea').innerHTML = `<div class="qwrap"><h3 style="font-size:18px">本轮情景模拟完成 ✅</h3>
            <p class="p">已记录在「学习统计」中。</p>
            <div class="study-head" style="margin-top:12px"><button class="btn-sm" id="sAgain">🔄 再来一轮</button><button class="btn-sm" id="sBack">← 返回卡片</button></div></div>`;
          $('#sAgain').addEventListener('click', newSim);
          $('#sBack').addEventListener('click', () => enter('cards'));
          return;
        }
        drawSim();
      }, 2300);
    }));
  }
  function bindSim() { $('#sNew').addEventListener('click', newSim); }

  /* =============== 5. 学习统计 ================= */
  function htmlStats() {
    return `<div class="study-head"><b>学习统计</b><span class="p">数据保存在本机浏览器（localStorage）</span>
      <span class="grow"></span><button class="btn-sm" id="stReset" style="color:var(--accent)">清空全部学习记录</button></div>
      <div id="stArea"></div>`;
  }
  function bindStats() { $('#stReset').addEventListener('click', () => { if (confirm('确定清空所有掌握度、收藏与学习记录？此操作不可撤销。')) { localStorage.removeItem('itprof_v1'); location.reload(); } }); }

  function drawStats() {
    const API = window.IT;
    const ST = API.ST;
    const all = API.ALL;
    let m0 = 0, m1 = 0, m2 = 0;
    all.forEach((a) => { const m = API.markOf(a.id); if (m === 2) m2++; else if (m === 1) m1++; else m0++; });
    const total = all.length || 1;
    const C = 2 * Math.PI * 52;
    const days = Object.keys(ST.days || {}).sort();
    const last7 = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7.push({ d: d.toISOString().slice(5, 10), n: (ST.days || {})[d.toISOString().slice(0, 10)] || 0 }); }
    const max = Math.max(1, ...last7.map((x) => x.n));

    $('#stArea').innerHTML = `
    <div class="stat-grid">
      <div class="stat-box">
        <h4>掌握度总览</h4>
        <div style="display:flex;align-items:center;gap:16px">
          <div class="hc-ring" style="width:104px;height:104px">
            <svg viewBox="0 0 120 120" class="ring" style="transform:rotate(-90deg)">
              <circle cx="60" cy="60" r="52" class="ring-bg" fill="none" stroke="var(--line)" stroke-width="11"></circle>
              <circle cx="60" cy="60" r="52" class="ring-fg" fill="none" stroke="var(--brand)" stroke-width="11" stroke-linecap="round"
                stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (m2 + m1 * .5) / total)}"></circle>
            </svg>
            <div class="hc-num"><b>${Math.round(((m2 + m1 * .5) / total) * 100)}%</b><span>掌握</span></div>
          </div>
          <div style="flex:1">
            <div class="modbar"><div class="mt"><span>● 已掌握</span><b>${m2}</b></div><div class="bar"><span style="width:${(m2 / total * 100).toFixed(1)}%;background:var(--brand)"></span></div></div>
            <div class="modbar"><div class="mt"><span>◐ 学习中</span><b>${m1}</b></div><div class="bar"><span style="width:${(m1 / total * 100).toFixed(1)}%;background:var(--gold)"></span></div></div>
            <div class="modbar"><div class="mt"><span>○ 未学</span><b>${m0}</b></div><div class="bar"><span style="width:${(m0 / total * 100).toFixed(1)}%;background:var(--line)"></span></div></div>
          </div>
        </div>
      </div>
      <div class="stat-box">
        <h4>练习表现</h4>
        <div class="modbar"><div class="mt"><span>选择题正确率</span><b>${ST.quiz.n ? Math.round(ST.quiz.ok / ST.quiz.n * 100) + '%（' + ST.quiz.ok + '/' + ST.quiz.n + '）' : '—'}</b></div><div class="bar"><span style="width:${ST.quiz.n ? (ST.quiz.ok / ST.quiz.n * 100) : 0}%"></span></div></div>
        <div class="modbar"><div class="mt"><span>填空题正确率</span><b>${ST.fill.n ? Math.round(ST.fill.ok / ST.fill.n * 100) + '%（' + ST.fill.ok + '/' + ST.fill.n + '）' : '—'}</b></div><div class="bar"><span style="width:${ST.fill.n ? (ST.fill.ok / ST.fill.n * 100) : 0}%;background:var(--blue)"></span></div></div>
        <div class="modbar"><div class="mt"><span>情景模拟正确率</span><b>${ST.sim.n ? Math.round(ST.sim.ok / ST.sim.n * 100) + '%（' + ST.sim.ok + '/' + ST.sim.n + '）' : '—'}</b></div><div class="bar"><span style="width:${ST.sim.n ? (ST.sim.ok / ST.sim.n * 100) : 0}%;background:var(--accent)"></span></div></div>
        <div style="margin-top:10px;font-size:12.5px;color:var(--muted)">累计学习 <b style="color:var(--ink)">${days.length}</b> 天 · 收藏 <b style="color:var(--ink)">${Object.keys(ST.favs || {}).length}</b> 条</div>
      </div>
      <div class="stat-box">
        <h4>最近 7 天学习量</h4>
        <div class="chart">${last7.map((x) => `<div class="cbar" style="height:${Math.max(3, x.n / max * 92)}px"><span>${x.n}</span></div>`).join('')}</div>
        <div style="height:22px"></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)"><span>${last7[0].d}</span><span>今天 ${last7[6].d}</span></div>
      </div>
    </div>
    <div class="stat-box" style="margin-top:12px">
      <h4>各模块掌握情况</h4>
      ${moduleRows()}
    </div>`;
  }

  function moduleRows() {
    const API = window.IT;
    const p = API.DB.professions.find((x) => x.id === scope.profId);
    const rows = [];
    p.sections.forEach((s) => {
      const ids = [];
      s.items.forEach((it) => { if (it.t === 'd') it.lines.forEach((l) => ids.push(l.id)); else ids.push(it.id); });
      if (s.blocks) s.blocks.forEach((b) => b.ex.forEach((e) => ids.push(e.id)));
      if (!ids.length) return;
      const ok = ids.filter((i) => API.markOf(i) === 2).length;
      const half = ids.filter((i) => API.markOf(i) === 1).length;
      rows.push({ t: s.title, pct: ((ok + half * .5) / ids.length) * 100, n: ids.length });
    });
    rows.sort((a, b) => a.pct - b.pct);
    return rows.slice(0, 12).map((r) => `<div class="modbar"><div class="mt"><span>${esc(r.t)} <small style="color:var(--muted)">${r.n} 条</small></span><b>${Math.round(r.pct)}%</b></div>
      <div class="bar"><span style="width:${r.pct}%;background:var(--brand)"></span></div></div>`).join('');
  }

  /* ---------------- 对外 ---------------- */
  window.Study = {
    open: open,
    close: close,
    start: function (type, profId, secId) {
      if (profId) scope.profId = profId;
      scope.secId = secId || null;
      // 若范围改变，重置卡片
      open(type);
      // 统计 tab 需要重绘
      if (tab === 'stats') setTimeout(() => { enter('stats'); drawStats(); }, 0);
    },
    setScope: function (profId, secId) { scope.profId = profId || scope.profId; scope.secId = secId || null; }
  };

  // 绑定弹层事件
  document.addEventListener('DOMContentLoaded', () => {
    $('#studyTabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab'); if (!t) return;
      tab = t.dataset.tab; renderTabs();
      if (tab === 'stats') { $('#studyBody').innerHTML = htmlStats(); bindStats(); drawStats(); } else enter(tab);
    });
    $('#btnStudyClose').addEventListener('click', close);
    $('#studyScope').addEventListener('change', (e) => {
      scope.secId = e.target.value || null;
      if (tab === 'cards') { C.shown = false; enter('cards'); }
      else if (tab === 'quiz') newQuiz();
      else if (tab === 'fill') newFill();
      else if (tab === 'sim') newSim();
      enter(tab);
    });
    $('#studyModal').addEventListener('click', (e) => { if (e.target.id === 'studyModal') close(); });
  });
})();
