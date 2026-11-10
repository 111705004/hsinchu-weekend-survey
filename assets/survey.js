// 新竹人週末調查：問卷流程。題目在 questions.js，網址與抽獎設定在 config.js。
(() => {
'use strict';
const URL_ = (typeof CONFIG !== 'undefined' && CONFIG.SCRIPT_URL) || '';
const LOT = (typeof CONFIG !== 'undefined' && CONFIG.LOTTERY) || { prize: '神秘禮物', winners: 1 };
const K_DRAFT = 'hs-survey-draft', K_DONE = 'hs-survey-done', K_PENDING = 'hs-survey-pending';
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const app = document.getElementById('app');
const nodesEl = document.getElementById('nodes');
const countEl = document.getElementById('count');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const blank = () => ({ quiz: {}, profile: {}, weekend: [], newPlaces: '', barriers: [], motivators: [], likert: {}, decide: [], duration: '',
  open: { wasted: '', trigger: '', other: '' }, pocket: [{}, {}, {}], pocketConsent: true, email: '', lotteryAgree: false, website: '', page: 0, started: Date.now() });
let S = Object.assign(blank(), ls.get(K_DRAFT) || {});
const save = () => ls.set(K_DRAFT, S);

// ── 小工具 ──
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
// 單選或複選的膠囊按鈕
function chips(opts, get, set, { multi = false, max = 99 } = {}) {
  const box = h('div', { class: 'chips' });
  const paint = () => box.querySelectorAll('button').forEach((b) => {
    const v = b.dataset.v; b.setAttribute('aria-pressed', multi ? get().includes(v) : get() === v);
  });
  opts.forEach((o) => box.append(h('button', { type: 'button', class: 'chip', 'data-v': o, onclick() {
    if (multi) {
      const cur = get().slice(); const i = cur.indexOf(o);
      if (i >= 0) cur.splice(i, 1); else if (cur.length < max) cur.push(o); else { flash(box, `最多選 ${max} 個`); return; }
      set(cur);
    } else set(get() === o ? '' : o);
    save(); paint(); clearErr();
  } }, o)));
  paint();
  return box;
}
function flash(near, msg) {
  let n = near.parentNode.querySelector('.err.inline');
  if (!n) { n = h('p', { class: 'err inline', role: 'status' }); near.after(n); }
  n.textContent = msg; clearTimeout(n._t); n._t = setTimeout(() => n.remove(), 2200);
}
function q(label, body, { req = false, sub = '' } = {}) {
  return h('fieldset', { class: 'q' }, h('legend', {}, label, req && h('span', { class: 'req', 'aria-label': '必填' }, ' *'), sub && h('small', {}, sub)), body);
}
let errEl = null;
const clearErr = () => { if (errEl) errEl.textContent = ''; };
const prizeLine = () => [LOT.deadline && `截止：${LOT.deadline}`, LOT.announce || '以 Email 通知中獎者'].filter(Boolean).join('・');

// ── 頁面 ──
const quizPage = (i) => ({ kind: 'quiz', render() {
  const item = QUIZ[i];
  const box = h('div', { class: 'opts' });
  let moving = false; // 連點不會一次跳兩題
  item.opts.forEach(([text], j) => box.append(h('button', { type: 'button', class: 'opt', 'aria-pressed': S.quiz[item.id] === j, onclick() {
    S.quiz[item.id] = j; save();
    box.querySelectorAll('.opt').forEach((b, k) => b.setAttribute('aria-pressed', k === j));
    if (!moving) { moving = true; setTimeout(next, 260); }
  } }, h('b', {}, 'ABCD'[j]), text)));
  return [h('p', { class: 'eyebrow' }, `心理測驗 ${i + 1} / ${QUIZ.length}`), h('h2', { class: 'quizq' }, item.q), box];
}, valid: () => S.quiz[QUIZ[i].id] != null || '選一個最像你的答案' });

const PAGES = [
  { kind: 'intro', render() {
    return [
      h('p', { class: 'eyebrow' }, '新竹人週末調查'),
      h('h1', {}, '你是哪種新竹人？'),
      h('p', { class: 'lead' }, '9 題心理測驗加上幾題真心話，最後會跑出一張屬於你的「新竹人卡」。'),
      h('div', { class: 'prize' }, h('b', {}, `填完可抽 ${LOT.prize}`), h('span', {}, `留 Email 就能參加，共抽 ${LOT.winners} 位。${prizeLine()}`)),
      h('ul', { class: 'facts' }, h('li', {}, '約 4 分鐘'), h('li', {}, '匿名，不需登入'), h('li', {}, '可以分享你的私房口袋名單')),
      h('div', { class: 'acts' }, h('button', { class: 'btn red', type: 'button', onclick: next }, '開始測驗')),
      h('p', { class: 'note' }, '答案只用於這次的研究分析，我們不會蒐集你的姓名或位置。'),
    ];
  }, valid: () => true },
  { kind: 'form', render() {
    return [h('p', { class: 'eyebrow' }, '先認識一下'), h('h2', {}, '你是住在新竹的誰？'),
      ...PROFILE.map((p) => q(p.q, chips(p.opts, () => S.profile[p.id] || '', (v) => { S.profile[p.id] = v; }), { req: p.req }))];
  }, valid: () => PROFILE.every((p) => !p.req || S.profile[p.id]) || '還有必填的題目沒選' },
  quizPage(0), quizPage(1), quizPage(2), quizPage(3), quizPage(4),
  { kind: 'form', render() {
    return [h('p', { class: 'eyebrow' }, '真心話 1'), h('h2', {}, '說真的，你的週末都在幹嘛？'),
      q('過去一個月的週末，你大部分時間在', chips(WEEKEND, () => S.weekend, (v) => { S.weekend = v; }, { multi: true }), { req: true, sub: '可複選' }),
      q('過去一個月，你在新竹去了幾次「以前沒去過的地方」？', chips(NEWPLACES, () => S.newPlaces, (v) => { S.newPlaces = v; }), { req: true, sub: '吃飯、散步、展覽都算' })];
  }, valid: () => !!(S.weekend.length && S.newPlaces) || '兩題都選一下' },
  quizPage(5), quizPage(6), quizPage(7), quizPage(8),
  { kind: 'form', render() {
    return [h('p', { class: 'eyebrow' }, '真心話 2'), h('h2', {}, '週末沒出門，通常是因為？'),
      q('選最主要的原因', chips(BARRIERS, () => S.barriers, (v) => { S.barriers = v; }, { multi: true, max: 3 }), { req: true, sub: '最多 3 個' }),
      h('label', { class: 'f' }, '還有別的原因嗎？（選填）',
        h('input', { type: 'text', id: 'f-other', maxlength: 400, value: S.open.other, placeholder: '例如：新竹的公車班次…', oninput(e) { S.open.other = e.target.value; save(); } }))];
  }, valid: () => S.barriers.length > 0 || '至少選一個原因' },
  { kind: 'form', render() {
    return [h('p', { class: 'eyebrow' }, '真心話 3'), h('h2', {}, '什麼會讓你更想出門？'),
      q('選最有用的', chips(MOTIVATORS, () => S.motivators, (v) => { S.motivators = v; }, { multi: true, max: 3 }), { req: true, sub: '最多 3 個' })];
  }, valid: () => S.motivators.length > 0 || '至少選一個' },
  { kind: 'form', render() {
    const list = LIKERT.map((l) => {
      const sc = h('div', { class: 'scale', role: 'group', 'aria-label': l.q });
      LIKERT_SCALE.forEach((lab, j) => sc.append(h('button', { type: 'button', 'aria-pressed': S.likert[l.id] === j + 1, onclick() {
        S.likert[l.id] = j + 1; save(); clearErr();
        sc.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', k === j));
      } }, h('span', {}, j + 1), lab)));
      return h('div', { class: 'lk' }, h('p', {}, l.q), sc);
    });
    return [h('p', { class: 'eyebrow' }, '真心話 4'), h('h2', {}, '你有多同意這些話？'), h('div', {}, list)];
  }, valid: () => LIKERT.every((l) => S.likert[l.id]) || '每一句都點一下同意程度' },
  { kind: 'form', render() {
    return [h('p', { class: 'eyebrow' }, '真心話 5'), h('h2', {}, '如果要出門的話……'),
      q('你通常怎麼決定週末去哪？', chips(DECIDE, () => S.decide, (v) => { S.decide = v; }, { multi: true }), { req: true, sub: '可複選' }),
      q('一趟在地小出走，你願意花多少時間？', chips(DURATION, () => S.duration, (v) => { S.duration = v; }), { req: true })];
  }, valid: () => !!(S.decide.length && S.duration) || '兩題都選一下' },
  { kind: 'form', render() {
    const ta = (k, ph) => h('textarea', { id: 'f-' + k, maxlength: 400, placeholder: ph, oninput(e) { S.open[k] = e.target.value; save(); } }, S.open[k]);
    return [h('p', { class: 'eyebrow' }, '真心話 6（選填，但我們超想看）'), h('h2', {}, '說說你的故事'),
      h('label', { class: 'f' }, '最近一次覺得「又浪費了一個週末」是什麼情況？', ta('wasted', '例如：本來想去內灣，結果躺到下午四點，最後去巨城吃晚餐')),
      h('label', { class: 'f' }, '什麼情況下，你會願意走出門？', ta('trigger', '例如：有人約、有明確目的地、不用自己找停車位'))];
  }, valid: () => true },
  { kind: 'form', render() {
    const cards = S.pocket.map((p, i) => {
      const set = (k) => (e) => { S.pocket[i][k] = e.target.value; save(); };
      return h('div', { class: 'pk' },
        h('h3', {}, `口袋名單 ${i + 1}`, i > 0 && h('span', { class: 'note' }, '選填')),
        h('label', { class: 'f' }, '店名', h('input', { type: 'text', id: `pk-name-${i}`, maxlength: 40, value: p.name || '', placeholder: i === 0 ? '例如：某間巷子裡的麵店' : '', oninput: set('name') })),
        h('div', { class: 'q' }, h('span', { class: 'ql' }, '類型'), chips(POCKET_CATS, () => S.pocket[i].cat || '', (v) => { S.pocket[i].cat = v; })),
        h('div', { class: 'two' },
          h('label', { class: 'f' }, '在哪一區或哪條路', h('input', { type: 'text', id: `pk-area-${i}`, maxlength: 40, value: p.area || '', placeholder: '例如：東區勝利路', oninput: set('area') })),
          h('label', { class: 'f' }, '一句話推薦', h('input', { type: 'text', id: `pk-why-${i}`, maxlength: 120, value: p.why || '', placeholder: '必點什麼？為什麼帶朋友去？', oninput: set('why') }))));
    });
    return [h('p', { class: 'eyebrow' }, '口袋名單'), h('h2', {}, '交出你的新竹私房店家'),
      h('p', { class: 'lead' }, '那種你會偷偷帶朋友去的店。寫一間就好，寫三間新竹濃度會更高。'),
      ...cards,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'f-consent', checked: S.pocketConsent, onchange(e) { S.pocketConsent = e.target.checked; save(); } }),
        h('span', {}, '我同意這些店家被整理成公開的推薦清單（不會顯示我是誰）。'))];
  }, valid: () => true },
  { kind: 'form', render() {
    const em = h('input', { type: 'email', id: 'f-email', maxlength: 80, value: S.email, autocomplete: 'email', inputmode: 'email', placeholder: 'you@example.com',
      oninput(e) { S.email = e.target.value; save(); clearErr(); paintBtn(); } });
    return [h('p', { class: 'eyebrow' }, '最後一步：抽獎'), h('h2', {}, `抽 ${LOT.prize}`),
      h('div', { class: 'prize' }, h('b', {}, `留下 Email 就能參加抽獎，共抽 ${LOT.winners} 位`), h('span', {}, prizeLine())),
      h('label', { class: 'f' }, 'Email（選填）', em),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'f-agree', checked: S.lotteryAgree, onchange(e) { S.lotteryAgree = e.target.checked; save(); clearErr(); } }),
        h('span', {}, '我同意 Email 只用於抽獎與中獎通知，活動結束後刪除。')),
      h('ul', { class: 'rules' },
        h('li', {}, '不留 Email 也可以送出，只是不能參加抽獎。'),
        h('li', {}, 'Email 和你的答案分開存放，我們看不出哪份答案是誰填的。'),
        h('li', {}, '同一個 Email 只算一次，重複填寫不會增加中獎機率。')),
      h('div', { class: 'trap', 'aria-hidden': 'true' }, h('label', {}, '網站', h('input', { type: 'text', tabindex: '-1', autocomplete: 'off', oninput(e) { S.website = e.target.value; } })))];
  }, valid() {
    const e = S.email.trim();
    if (!e) return true;
    if (!EMAIL_RE.test(e)) return 'Email 格式好像不對，確認一下；不想抽獎可以清空再送出。';
    if (!S.lotteryAgree) return '要參加抽獎，請勾選同意 Email 的使用方式。';
    return true;
  }, last: true },
];

// ── 導覽 ──
function drawNodes() {
  nodesEl.textContent = '';
  PAGES.forEach((_, i) => nodesEl.append(h('li', { class: i < S.page ? 'done' : i === S.page ? 'now' : '' })));
  countEl.textContent = S.page ? `${S.page} / ${PAGES.length - 1}` : '';
}
function paintBtn() {
  const b = document.getElementById('nextBtn');
  if (b && PAGES[S.page].last) b.textContent = S.email.trim() ? '送出並參加抽獎' : '不抽獎，直接送出';
}
function show() {
  const p = PAGES[S.page];
  app.textContent = '';
  const page = h('section', { class: 'page' }, p.render());
  if (p.kind !== 'intro') {
    errEl = h('p', { class: 'err', role: 'alert' });
    const acts = h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'btn ghost', onclick: prev }, '上一題'),
      p.kind !== 'quiz' && h('button', { type: 'button', class: 'btn' + (p.last ? ' red' : ''), id: 'nextBtn', onclick: next }, '下一步'));
    page.append(errEl, acts);
  }
  app.append(page);
  paintBtn();
  drawNodes();
  window.scrollTo({ top: 0 });
  app.focus({ preventScroll: true });
}
function next() {
  const ok = PAGES[S.page].valid();
  if (ok !== true) { if (errEl) errEl.textContent = ok; return; }
  if (PAGES[S.page].last) return submit();
  S.page = Math.min(S.page + 1, PAGES.length - 1); save(); show();
}
function prev() { S.page = Math.max(0, S.page - 1); save(); show(); }

// ── 計分 ──
function score() {
  const axes = { ho: 0, pf: 0, sg: 0 };
  QUIZ.forEach((it) => { const j = S.quiz[it.id]; if (j != null) axes[it.axis] += it.opts[j][1]; });
  const type = (axes.ho > 0 ? 'O' : 'H') + (axes.pf > 0 ? 'P' : 'F') + (axes.sg > 0 ? 'G' : 'S');
  return { axes, type };
}
const YEARS_PCT = { '未滿 1 年': 20, '1–3 年': 40, '3–10 年': 62, '10 年以上': 80, '土生土長': 92 };

// ── 送出 ──
// 不設 content-type（預設 text/plain），Apps Script 才不會擋跨網域請求
async function post(body) {
  if (!URL_) throw new Error('no_url');
  const r = await fetch(URL_, { method: 'POST', body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'failed');
  return j;
}
async function submit() {
  const btn = document.getElementById('nextBtn');
  if (btn) { btn.disabled = true; btn.textContent = '蓋章中…'; }
  const { axes, type } = score();
  const email = S.email.trim();
  const body = {
    v: SURVEY_VERSION, type, axes, quiz: Object.fromEntries(QUIZ.map((it) => [it.id, S.quiz[it.id]])),
    profile: S.profile, weekend: S.weekend, newPlaces: S.newPlaces, barriers: S.barriers, motivators: S.motivators, likert: S.likert,
    decide: S.decide, duration: S.duration, open: S.open,
    pocket: S.pocket.filter((p) => p.name && p.name.trim()), pocketConsent: S.pocketConsent,
    lottery: email && S.lotteryAgree ? { email } : null, website: S.website,
    src: new URLSearchParams(location.search).get('src') || '', secs: Math.round((Date.now() - S.started) / 1000),
  };
  let res = null, offline = false;
  try { res = await post(body); }
  catch { offline = true; const q = ls.get(K_PENDING) || []; q.push({ ...body, ts: new Date().toISOString() }); ls.set(K_PENDING, q); }
  const done = { type, axes, years: S.profile.years, pockets: body.pocket.length, no: res?.no || null, stats: res?.stats || null, offline, lottery: !!body.lottery };
  ls.set(K_DONE, done); ls.del(K_DRAFT);
  result(done);
}
// 先前沒送出去的（例如訊號不好），下次打開時補送
async function flush() {
  const q = ls.get(K_PENDING); if (!q?.length || !URL_) return;
  const left = [];
  for (const b of q) { try { await post(b); } catch { left.push(b); } }
  left.length ? ls.set(K_PENDING, left) : ls.del(K_PENDING);
}

// ── 結果卡 ──
function result(d) {
  const t = TYPES[d.type], mate = TYPES[t.mate];
  const pct = (v) => Math.round(((v + 3) / 6) * 100);
  const bars = [['出門力', pct(d.axes.ho)], ['計畫力', pct(d.axes.pf)], ['揪團力', pct(d.axes.sg)],
    ['新竹濃度', Math.min(100, (YEARS_PCT[d.years] || 50) + d.pockets * 3)]];
  const no = d.no ? String(d.no).padStart(4, '0') : '----';
  nodesEl.textContent = ''; countEl.textContent = '';
  app.textContent = '';
  const rare = h('p', { class: 'rare', hidden: true });
  const card = h('article', { class: 'card', style: `--c:${t.color}`, 'aria-label': '你的新竹人卡' },
    h('div', { class: 'card-hd' },
      h('div', {}, h('p', { class: 'card-id' }, `竹民證 No.${no}`), h('h2', {}, t.name), h('p', { class: 'code' }, d.type.split('').join(' · '))),
      h('div', { class: 'stamp', 'aria-hidden': 'true' }, t.seal)),
    h('p', { class: 'line' }, t.line),
    h('ul', { class: 'bars' }, bars.map(([k, v]) => h('li', {}, k, h('i', { style: `--w:${v}%` }), h('span', {}, v + '%')))),
    h('dl', { class: 'kv' },
      h('dt', {}, '天生技能'), h('dd', {}, t.skill),
      h('dt', {}, '致命弱點'), h('dd', {}, t.weak),
      h('dt', {}, '最佳拍檔'), h('dd', {}, mate.name),
      h('dt', {}, '週末處方'), h('dd', {}, t.tip)));
  const st = d.stats;
  if (st?.total) {
    const same = st.types?.[d.type] || 1;
    rare.hidden = false;
    rare.append('你是第 ', h('b', {}, st.total), ' 位領卡的新竹人；目前 ', h('b', {}, Math.round((same / st.total) * 100) + '%'), ' 的人跟你同一型。');
  }
  const msg = h('p', { class: 'note', role: 'status' });
  app.append(h('section', { class: 'page' },
    h('p', { class: 'eyebrow' }, '你的新竹人卡'), card, rare,
    h('div', { class: 'prize' }, d.lottery
      ? [h('b', {}, '已登記抽獎'), h('span', {}, `${prizeLine()}。祝你中獎！`)]
      : [h('b', {}, '這次沒有參加抽獎'), h('span', {}, '沒有留 Email，所以不在抽獎名單裡。')]),
    d.offline && h('p', { class: 'note' }, '網路好像不太穩，你的答案先存在這台裝置，下次打開這頁會自動補送。'),
    h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'btn red', onclick: () => saveImage(d, t, bars, no).catch(() => { msg.textContent = '這個瀏覽器存不了圖，直接截圖也可以。'; }) }, '存成圖片'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => share(msg) }, '叫朋友來測')),
    msg,
    h('button', { type: 'button', class: 'link', onclick() { ls.del(K_DONE); S = blank(); save(); show(); } }, '重新測一次')));
  window.scrollTo({ top: 0 });
}
async function share(msg) {
  const url = location.origin + location.pathname + '?src=share';
  const text = '測測看你是哪種新竹人，填完還能抽獎';
  try { if (navigator.share) { await navigator.share({ title: '你是哪種新竹人？', text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); msg.textContent = '連結已複製，貼給朋友吧。'; }
  catch { msg.textContent = url; }
}

// 用 canvas 畫一張 1080×1920（限動尺寸）的卡
async function saveImage(d, t, bars, no) {
  try { await document.fonts.ready; } catch {}
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const serif = "'Noto Serif TC','Songti TC',serif", sans = "'Noto Sans TC','PingFang TC',sans-serif";
  x.fillStyle = '#eff1eb'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#f8f9f5'; x.strokeStyle = '#cbd3c8'; x.lineWidth = 3;
  round(x, 60, 60, W - 120, H - 120, 28); x.fill(); x.stroke();
  x.fillStyle = t.color; x.fillRect(60, 60, W - 120, 16);
  x.fillStyle = '#4c5d54'; x.font = `500 30px ${sans}`; x.fillText(`竹民證 No.${no}`, 120, 170);
  x.fillStyle = '#1d2b25'; x.font = `900 84px ${serif}`; wrap(x, t.name, 120, 280, 640, 100);
  x.fillStyle = t.color; x.font = `700 32px ${sans}`; x.fillText(d.type.split('').join(' · '), 120, t.name.length > 7 ? 460 : 360);
  x.save(); x.translate(860, 250); x.rotate(-0.14);
  x.strokeStyle = '#b23a2b'; x.lineWidth = 9; x.strokeRect(-95, -95, 190, 190);
  x.fillStyle = '#b23a2b'; x.font = `900 130px ${serif}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.seal, 0, 8);
  x.restore();
  let y = t.name.length > 7 ? 560 : 470;
  x.fillStyle = '#1d2b25'; x.font = `600 42px ${serif}`; y = wrap(x, t.line, 120, y, W - 240, 64) + 110;
  bars.forEach(([k, v]) => {
    x.fillStyle = '#4c5d54'; x.font = `500 32px ${sans}`; x.fillText(k, 120, y + 12);
    x.fillStyle = '#dde6da'; round(x, 320, y - 14, 520, 26, 13); x.fill();
    x.fillStyle = t.color; round(x, 320, y - 14, Math.max(26, 520 * v / 100), 26, 13); x.fill();
    x.fillStyle = '#1d2b25'; x.font = `700 32px ${sans}`; x.textAlign = 'right'; x.fillText(v + '%', W - 120, y + 12); x.textAlign = 'left';
    y += 82;
  });
  y += 50;
  [['天生技能', t.skill], ['致命弱點', t.weak], ['最佳拍檔', TYPES[t.mate].name], ['週末處方', t.tip]].forEach(([k, v]) => {
    x.fillStyle = '#4c5d54'; x.font = `500 30px ${sans}`; x.fillText(k, 120, y);
    x.fillStyle = '#1d2b25'; x.font = `500 36px ${sans}`; y = wrap(x, v, 300, y, W - 420, 52) + 78;
  });
  x.fillStyle = '#2e5b45'; x.font = `700 30px ${sans}`; x.fillText('你是哪種新竹人？來測測看', 120, H - 120);
  const blob = await new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('blob'))), 'image/png'));
  const a = h('a', { href: URL.createObjectURL(blob), download: `新竹人卡-${t.name}.png` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function round(x, l, t, w, hh, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + hh, r); x.arcTo(l + w, t + hh, l, t + hh, r); x.arcTo(l, t + hh, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
// 中文逐字換行，回傳最後一行的 y
function wrap(x, text, l, y, maxW, lh) {
  let line = '';
  for (const ch of text) {
    if (x.measureText(line + ch).width > maxW && line) { x.fillText(line, l, y); line = ch; y += lh; } else line += ch;
  }
  x.fillText(line, l, y); return y;
}

// ── 啟動 ──
flush();
const done = ls.get(K_DONE);
if (done && TYPES[done.type]) result(done); else show();
})();
