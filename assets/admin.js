// 新竹人心理測驗：後台。讀全部回覆、篩選、畫圖、匯出、抽獎。題目定義在 questions.js。
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const URL_ = (typeof CONFIG !== 'undefined' && CONFIG.SCRIPT_URL) || '';
const LOT = (typeof CONFIG !== 'undefined' && CONFIG.LOTTERY) || { prize: '神秘禮物', winners: 1 };
let ALL = [], KEY = '', LOCAL = false;

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
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const typeName = (c) => (TYPES[c] ? `${TYPES[c].name}（${c}）` : c);
async function api(body) {
  const r = await fetch(URL_, { method: 'POST', body: JSON.stringify({ ...body, key: KEY }) });
  const j = await r.json();
  if (!j.ok) throw new Error({ unauthorized: '密碼不對，或 Apps Script 還沒設定 ADMIN_KEY（至少 12 個字）。', locked: '密碼錯太多次，已暫時鎖住，15 分鐘後再試。' }[j.error] || `讀取失敗（${j.error}）`);
  return j;
}

// ── 載入 ──
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  KEY = $('key').value.trim(); $('loginErr').textContent = '';
  if (!URL_) { $('loginErr').textContent = 'assets/config.js 還沒填 SCRIPT_URL。可以先看這台裝置暫存的回覆。'; return; }
  try {
    const j = await api({ action: 'list' });
    try { sessionStorage.setItem('hs-admin-key', KEY); } catch {}
    start(j.responses || [], '試算表');
  } catch (err) { $('loginErr').textContent = err.message || '連不到試算表。'; }
});
$('localBtn').addEventListener('click', () => {
  let rows = []; try { rows = JSON.parse(localStorage.getItem('hs-quiz-pending')) || []; } catch {}
  LOCAL = true; start(rows, '這台裝置暫存');
});
try { const k = sessionStorage.getItem('hs-admin-key'); if (k && URL_) { $('key').value = k; $('loginForm').requestSubmit(); } } catch {}

function start(rows, label) {
  ALL = rows; $('login').hidden = true; $('dash').hidden = false;
  $('n').textContent = `${label}・共 ${rows.length} 份`;
  const opts = (sel, vals, all) => { sel.textContent = ''; sel.append(h('option', { value: '' }, all)); vals.forEach(([v, t]) => sel.append(h('option', { value: v }, t))); };
  opts($('fRole'), PROFILE[0].opts.map((o) => [o, o]), '全部身分');
  opts($('fType'), Object.keys(TYPES).map((c) => [c, typeName(c)]), '全部類型');
  opts($('fAge'), PROFILE[1].opts.map((o) => [o, o]), '全部年齡');
  ['fRole', 'fType', 'fAge'].forEach((id) => $(id).addEventListener('change', render));
  render();
  lottery();
}
function filtered() {
  const role = $('fRole').value, type = $('fType').value, age = $('fAge').value;
  return ALL.filter((r) => (!role || r.profile?.role === role) && (!type || r.type === type) && (!age || r.profile?.age === age));
}

// ── 圖表元件 ──
function count(rows, get, opts) {
  const m = new Map((opts || []).map((o) => [o, 0]));
  rows.forEach((r) => { const v = get(r); (Array.isArray(v) ? v : [v]).forEach((x) => { if (x) m.set(x, (m.get(x) || 0) + 1); }); });
  return [...m.entries()];
}
// 橫條圖：分母是填答人數（複選題加總會超過 100%）
function hbar(entries, base, { sort = true, topN = 3 } = {}) {
  const list = sort ? entries.slice().sort((a, b) => b[1] - a[1]) : entries;
  const max = Math.max(1, ...list.map((e) => e[1]));
  // 只有排序過的題目標出前幾名（紅色），同分時依原本選項順序
  return h('ul', { class: 'hb' }, list.map(([k, v], i) => h('li', { class: sort && v > 0 && i < topN ? 'top' : '' },
    h('span', {}, k), h('i', { style: `--w:${(v / max) * 100}%` }), h('em', {}, h('b', {}, pct(v, base) + '%'), ` ${v}`))));
}
function likertBlock(rows) {
  const box = h('div', { class: 'lks' });
  LIKERT.forEach((l) => {
    const vals = rows.map((r) => r.likert?.[l.id]).filter(Boolean);
    const n = vals.length, c = [1, 2, 3, 4, 5].map((s) => vals.filter((v) => v === s).length);
    const mean = n ? (vals.reduce((a, b) => a + b, 0) / n).toFixed(2) : '—';
    box.append(h('div', { class: 'lkrow' },
      h('p', {}, h('span', {}, l.q), h('b', {}, `同意 ${pct(c[3] + c[4], n)}%・平均 ${mean}`)),
      h('div', { class: 'stack', role: 'img', 'aria-label': `${l.q}：` + c.map((x, i) => `${LIKERT_SCALE[i]} ${x}`).join('，') },
        c.map((x, i) => x ? h('span', { class: 's' + (i + 1), style: `width:${pct(x, n)}%`, title: `${LIKERT_SCALE[i]} ${x} 人` }, pct(x, n) >= 7 ? pct(x, n) + '%' : '') : null))));
  });
  box.append(h('div', { class: 'legend' }, LIKERT_SCALE.map((s, i) => h('span', {}, h('i', { class: 's' + (i + 1) }), s))));
  return box;
}
// 交叉表：列 = 分組，欄 = 選項，格子 = 該組中選這項的比例；顏色越深越高
function crosstab(rows, groupOf, groups, valOf, cols) {
  const t = h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, '分組'), h('th', { class: 'num' }, 'n'), cols.map((c) => h('th', { class: 'num' }, c)))));
  const body = h('tbody');
  groups.forEach((g) => {
    const gr = rows.filter((r) => groupOf(r) === g); if (!gr.length) return;
    body.append(h('tr', {}, h('td', {}, g), h('td', { class: 'num' }, gr.length), cols.map((c) => {
      const p = pct(gr.filter((r) => (valOf(r) || []).includes(c)).length, gr.length);
      return h('td', { class: 'num', style: `background:rgba(46,91,69,${(p / 100) * 0.55});${p > 55 ? 'color:#fff' : ''}` }, p + '%');
    })));
  });
  t.append(body);
  return h('div', { class: 'tw' }, t);
}
const sec = (title, note, ...kids) => h('section', { class: 'ad-sec' }, h('h2', {}, title), note && h('p', { class: 'hyp' }, note), kids);
const col = (title, ...kids) => h('div', {}, h('h3', {}, title), kids);
const lineGroup = (r) => (r.likert?.l1 >= 4 ? '自認兩點一線（l1 ≥ 4）' : '其他人');

// ── 主畫面 ──
function render() {
  const rows = filtered(), n = rows.length, out = $('out');
  out.textContent = '';
  if (!n) { out.append(h('p', { class: 'empty' }, ALL.length ? '這個篩選條件下沒有回覆。' : '還沒有回覆。把測驗連結發出去吧。')); return; }
  const agree = (id) => rows.filter((r) => r.likert?.[id] >= 4).length;
  const zero = rows.filter((r) => r.newPlaces === '0 次').length;
  const homeish = rows.filter((r) => (r.weekend || []).some((w) => ['在家耍廢、補眠', '追劇、打電動、滑手機'].includes(w))).length;
  const pockets = rows.reduce((a, r) => a + (r.pocket?.length || 0), 0);
  const secs = rows.map((r) => r.secs).filter((s) => s > 0).sort((a, b) => a - b);
  const median = secs.length ? Math.round(secs[Math.floor(secs.length / 2)] / 60 * 10) / 10 : '—';
  const fast = rows.filter((r) => r.secs > 0 && r.secs < 60).length;

  out.append(h('div', { class: 'tiles' },
    tile(n, '份回覆', `填答時間中位數 ${median} 分鐘${fast ? `・${fast} 份不到 1 分鐘` : ''}`),
    tile(pct(agree('l1'), n) + '%', '同意自己「兩點一線」', 'l1 選 4–5', true),
    tile(pct(zero, n) + '%', '上個月沒去過任何新地方', '新地點 0 次', true),
    tile(pct(homeish, n) + '%', '週末主要在家耍廢或滑手機', '複選題，有選任一項'),
    tile(pct(agree('l3'), n) + '%', '希望有人告訴他週末去哪', 'l3 選 4–5', true),
    tile(pockets, '間口袋店家', `${rows.filter((r) => r.pocket?.length).length} 人提供`)));

  out.append(sec('週末現況', null,
    h('div', { class: 'grid2' },
      col('過去一個月的週末在做什麼（複選）', hbar(count(rows, (r) => r.weekend, WEEKEND), n)),
      col('過去一個月去過幾次沒去過的地方', hbar(count(rows, (r) => r.newPlaces, NEWPLACES), n, { sort: false }),
        h('h3', {}, '心理測驗：出門力分布'),
        hbar(count(rows, (r) => ({ '-3': '超宅（-3）', '-1': '偏宅（-1）', 1: '偏出門（+1）', 3: '超愛出門（+3）' })[r.axes?.ho],
          ['超宅（-3）', '偏宅（-1）', '偏出門（+1）', '超愛出門（+3）']), n, { sort: false })))));

  out.append(sec('為什麼不出門', null,
    h('div', { class: 'grid2' },
      col('不出門的原因（最多選 3）', hbar(count(rows, (r) => r.barriers, BARRIERS), n)),
      col('平常怎麼決定去哪（複選）', hbar(count(rows, (r) => r.decide, DECIDE), n))),
    h('h3', {}, '原因 × 身分（各身分中選這項的比例）'),
    crosstab(rows, (r) => r.profile?.role, PROFILE[0].opts, (r) => r.barriers, BARRIERS),
    h('h3', {}, '原因 × 新竹人類型'),
    crosstab(rows, (r) => TYPES[r.type]?.name, Object.values(TYPES).map((t) => t.name), (r) => r.barriers, BARRIERS)));

  out.append(sec('什麼會讓人出門', '看各選項的排名，也比較「自認兩點一線」的人和其他人選得有什麼不同。',
    h('div', { class: 'grid2' },
      col('出門誘因（最多選 3）', hbar(count(rows, (r) => r.motivators, MOTIVATORS), n)),
      col('願意花多少時間', hbar(count(rows, (r) => r.duration, DURATION), n, { sort: false }))),
    h('h3', {}, '出門誘因 × 是否自認兩點一線'),
    crosstab(rows, lineGroup, ['自認兩點一線（l1 ≥ 4）', '其他人'], (r) => r.motivators, MOTIVATORS),
    h('div', { class: 'grid2' },
      col('同意程度（全部）', likertBlock(rows)),
      col('同意程度（自認兩點一線的人）', (() => { const g = rows.filter((r) => r.likert?.l1 >= 4); return g.length ? likertBlock(g) : h('p', { class: 'note' }, '沒有符合的回覆'); })()))));

  out.append(sec('新竹人卡分布', null, h('div', { class: 'grid2' },
    col('類型', hbar(count(rows, (r) => TYPES[r.type]?.name, Object.values(TYPES).map((t) => t.name)), n)),
    col('受訪者輪廓',
      ...PROFILE.slice(0, 5).map((p) => [h('p', { class: 'note' }, p.q), hbar(count(rows, (r) => r.profile?.[p.id], p.opts), n, { sort: false, topN: 1 })])))));

  out.append(qualSection(rows));
  out.append(pocketSection(rows));
}
function tile(big, label, sub, hi) { return h('div', { class: 'tile' + (hi ? ' hi' : '') }, h('b', {}, big), h('span', {}, label), sub && h('span', { class: 'note' }, sub)); }

// ── 質化 ──
function qualSection(rows) {
  const fields = [['wasted', '「又浪費一個週末」的時刻'], ['trigger', '什麼情況會願意出門'], ['other', '其他不出門的原因']];
  const list = h('div', { class: 'quotes' });
  const tabs = h('div', { class: 'tabs2' });
  const search = h('input', { type: 'text', id: 'qSearch', placeholder: '搜尋關鍵字，例如：停車、巨城、累' });
  let cur = 'wasted';
  const draw = () => {
    list.textContent = '';
    const kw = search.value.trim();
    const items = rows.filter((r) => r.open?.[cur] && (!kw || r.open[cur].includes(kw)));
    if (!items.length) list.append(h('p', { class: 'note' }, '沒有符合的回答'));
    items.forEach((r) => list.append(h('div', { class: 'quote' }, r.open[cur],
      h('small', {}, [TYPES[r.type]?.name, r.profile?.role, r.profile?.age, r.profile?.area].filter(Boolean).join('・')))));
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === cur));
  };
  fields.forEach(([k, t]) => tabs.append(h('button', { type: 'button', class: 'chip', 'data-k': k, onclick() { cur = k; draw(); } },
    `${t}（${rows.filter((r) => r.open?.[k]).length}）`)));
  search.addEventListener('input', draw);
  draw();
  return sec('質化回答', '可依上方篩選看特定族群；用關鍵字找重複出現的說法，挑幾則當簡報引言。', tabs, search, list);
}

// ── 口袋名單 ──
const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/[（(].*?[）)]/g, '').toLowerCase();
function pocketSection(rows) {
  const m = new Map();
  rows.forEach((r) => (r.pocket || []).forEach((p) => {
    const k = norm(p.name); if (!k) return;
    const g = m.get(k) || { name: p.name, n: 0, types: {} };
    g.n++; if (r.type) g.types[TYPES[r.type]?.name || r.type] = (g.types[TYPES[r.type]?.name || r.type] || 0) + 1;
    m.set(k, g);
  }));
  const g = [...m.values()].sort((a, b) => b.n - a.n);
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 3).join('、');
  const body = g.length ? h('div', { class: 'tw' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, '店名'), h('th', { class: 'num' }, '推薦數'), h('th', {}, '推薦者類型'))),
    h('tbody', {}, g.map((x) => h('tr', {}, h('td', {}, x.name), h('td', { class: 'num' }, x.n), h('td', {}, top(x.types)))))))
    : h('p', { class: 'empty' }, '還沒有人推薦店家。');
  return sec('口袋名單', `共 ${g.length} 間不重複店家。店名相同（忽略空白與括號）會合併計數；試算表的「口袋名單」分頁有每一筆原始資料。`, body);
}

// ── 抽獎 ──
async function lottery() {
  const box = $('lottery');
  box.textContent = '';
  box.append(h('h2', {}, `抽獎：${LOT.prize}`));
  if (LOCAL) {
    const pool = [...new Set(ALL.filter((r) => r.lottery?.draw).map((r) => r.lottery.email.toLowerCase()))];
    box.append(h('p', { class: 'note' }, `本機測試模式：這台裝置有 ${pool.length} 個不重複 Email。正式抽獎要登入試算表後在這裡抽，結果會記到「中獎紀錄」分頁。`));
    return;
  }
  let s;
  try { s = await api({ action: 'lottery' }); } catch (e) { box.append(h('p', { class: 'err' }, e.message)); return; }
  const panel = h('div', { class: 'lot' });
  const won = new Set(s.winners.map((w) => w.email.toLowerCase()));
  const left = Math.max(0, s.unique - won.size);
  panel.append(h('p', {}, `參加抽獎的不重複 Email `, h('b', {}, s.unique), ` 個（還沒中獎 ${left} 個）；想搶先體驗的 `, h('b', {}, s.early ?? 0), ' 個。每個 Email 中獎機率相同，不會重複中獎。'));
  const msg = h('p', { class: 'note', role: 'status' });
  const n = Math.max(1, Number(LOT.winners) || 1);
  let armed = false;
  const btn = h('button', { type: 'button', class: 'btn red', disabled: !left, async onclick() {
    if (!armed) { armed = true; btn.textContent = `確定抽出 ${Math.min(n, left)} 位？再按一次`; msg.textContent = '抽出後會寫進「中獎紀錄」分頁，建議全隊一起看著按，或錄影存證。'; return; }
    btn.disabled = true; btn.textContent = '抽獎中…';
    try { const r = await api({ action: 'draw', n }); msg.textContent = `第 ${r.round} 輪抽出：${r.picked.join('、') || '（沒有可抽的 Email）'}`; lottery(); }
    catch (e) { msg.textContent = e.message; btn.disabled = false; }
  } }, left ? `抽出 ${Math.min(n, left)} 位得主` : '沒有可抽的 Email');
  panel.append(h('div', { class: 'acts' }, btn), msg);
  if (s.winners.length) {
    panel.append(h('h3', {}, '中獎紀錄'), h('ul', { class: 'winners' }, s.winners.map((w) =>
      h('li', {}, h('b', {}, w.email), h('span', { class: 'note' }, `第 ${w.round} 輪・${new Date(w.at).toLocaleString('zh-TW')}`)))));
  }
  box.append(panel);
}

// ── 匯出 ──
function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// 開頭是 = + - @ 的文字，Excel 會當公式執行，前面加 ' 擋掉
const csvCell = (v) => { let s = Array.isArray(v) ? v.join('|') : v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (head, lines) => '﻿' + [head, ...lines].map((l) => l.map(csvCell).join(',')).join('\r\n');
const stamp = () => new Date().toISOString().slice(0, 10);

$('exCsv').addEventListener('click', () => {
  const head = ['ts', 'type', 'type_name', 'ho', 'pf', 'sg', ...QUIZ.map((x) => x.id), ...PROFILE.map((p) => p.id), 'weekend', 'newPlaces', 'barriers', 'motivators',
    ...LIKERT.map((l) => l.id), 'decide', 'duration', 'open_wasted', 'open_trigger', 'open_other', 'pocket_count', 'in_lottery', 'secs'];
  const lines = filtered().map((r) => [r.ts, r.type, TYPES[r.type]?.name, r.axes?.ho, r.axes?.pf, r.axes?.sg, ...QUIZ.map((x) => r.quiz?.[x.id]),
    ...PROFILE.map((p) => r.profile?.[p.id]), r.weekend, r.newPlaces, r.barriers, r.motivators, ...LIKERT.map((l) => r.likert?.[l.id]), r.decide, r.duration,
    r.open?.wasted, r.open?.trigger, r.open?.other, r.pocket?.length || 0, r.lottery ? 1 : 0, r.secs]);
  download(`新竹人測驗-回覆-${stamp()}.csv`, toCsv(head, lines), 'text/csv;charset=utf-8');
});
$('exPocket').addEventListener('click', () => {
  const lines = filtered().flatMap((r) => (r.pocket || []).map((p) => [r.ts, p.name, r.type, r.profile?.role]));
  download(`新竹人測驗-口袋名單-${stamp()}.csv`, toCsv(['ts', 'name', 'type', 'role'], lines), 'text/csv;charset=utf-8');
});
})();
