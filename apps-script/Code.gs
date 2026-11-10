/**
 * 新竹人心理測驗：Google Apps Script 後端（貼到試算表的「擴充功能 → Apps Script」）。
 *
 * 試算表會有四個分頁：
 *   回覆       每份測驗一列（不含 Email），最後一欄是原始 JSON，後台用它畫圖
 *   口袋名單   每間店一列，方便團隊直接整理
 *   抽獎名單   只有日期、Email、是否抽獎、是否要搶先體驗；跟答案分開存，看不出哪份答案是誰的
 *   中獎紀錄   每次在後台抽獎的結果
 *
 * 設定：專案設定 → 指令碼屬性 → 新增 ADMIN_KEY（後台密碼，至少 12 個字）。
 * 部署：部署 → 新增部署作業 → 網頁應用程式；執行身分「我」，存取權「所有人」。
 */

const SHEETS = {
  resp: { name: '回覆', head: ['時間', '類型', '出門軸', '計畫軸', '揪團軸', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9',
    '身分', '年齡', '居住區', '在新竹多久', '交通', '同住', '週末在做什麼', '上月新地點', '不出門原因', '出門誘因',
    'l1 兩點一線', 'l2 想認識新竹', 'l3 希望有人告訴我去哪', 'l4 想要附近小出走', '怎麼決定去哪', '願意花多久',
    '浪費週末的時刻', '什麼情況會出門', '其他原因', '推薦店家數', '有參加抽獎', '填答秒數', 'JSON'] },
  pocket: { name: '口袋名單', head: ['時間', '店名', '填答者類型', '填答者身分'] },
  lot: { name: '抽獎名單', head: ['日期', 'Email', '參加抽獎', '搶先體驗'] },
  win: { name: '中獎紀錄', head: ['抽出時間', 'Email', '第幾輪'] },
};
const TYPE_CODES = ['HPS', 'HPG', 'HFS', 'HFG', 'OPS', 'OPG', 'OFS', 'OFG'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PER_MINUTE = 60;      // 全站每分鐘最多收幾份，擋灌票程式
const MAX_LOGIN_FAILS = 10;     // 後台密碼錯幾次就鎖 15 分鐘

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function sheet(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const def = SHEETS[key];
  let sh = ss.getSheetByName(def.name);
  if (!sh) { sh = ss.insertSheet(def.name); sh.appendRow(def.head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, def.head.length).setFontWeight('bold'); }
  return sh;
}
/** 第一次手動執行一次，把四個分頁建好。 */
function setup() { Object.keys(SHEETS).forEach(sheet); }

// ── 清理輸入：白名單＋長度限制 ──
const str = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return isFinite(n) && n >= lo && n <= hi ? n : null; };
const arr = (a, max, len) => (Array.isArray(a) ? a : []).slice(0, max).map((s) => str(s, len)).filter(String);
// 開頭是 = + - @ 的文字，試算表會當成公式執行（公式注入）；前面加 ' 讓它變成純文字
const safe = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
function clean(b) {
  const quiz = {}, likert = {}, p = b.profile || {}, o = b.open || {};
  for (let i = 1; i <= 9; i++) quiz['q' + i] = int(b.quiz && b.quiz['q' + i], 0, 3);
  for (let i = 1; i <= 6; i++) likert['l' + i] = int(b.likert && b.likert['l' + i], 1, 5);
  return {
    v: int(b.v, 1, 99) || 1,
    type: TYPE_CODES.indexOf(b.type) >= 0 ? b.type : null,
    axes: { ho: int(b.axes && b.axes.ho, -3, 3), pf: int(b.axes && b.axes.pf, -3, 3), sg: int(b.axes && b.axes.sg, -3, 3) },
    quiz: quiz,
    profile: { role: str(p.role, 24), age: str(p.age, 24), area: str(p.area, 24), years: str(p.years, 24), transport: str(p.transport, 24), live: str(p.live, 24) },
    weekend: arr(b.weekend, 12, 24), newPlaces: str(b.newPlaces, 12), barriers: arr(b.barriers, 3, 24), motivators: arr(b.motivators, 3, 24),
    likert: likert, decide: arr(b.decide, 8, 24), duration: str(b.duration, 12),
    open: { wasted: str(o.wasted, 400), trigger: str(o.trigger, 400), other: str(o.other, 400) },
    pocket: (Array.isArray(b.pocket) ? b.pocket : []).slice(0, 3).map((x) => ({ name: str(x && x.name, 40) })).filter((x) => x.name),
    secs: int(b.secs, 0, 7200),
  };
}
const join = (a) => (a || []).join('|');

function tooMany() {
  const cache = CacheService.getScriptCache();
  const k = 'rate:' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), 120);
  return n > MAX_PER_MINUTE;
}

function saveResponse(b) {
  if (b.website) return { ok: true }; // 機器人陷阱欄位：有填就假裝成功、不存
  if (tooMany()) return { ok: false, error: 'busy' };
  const r = clean(b);
  if (!r.type) return { ok: false, error: 'bad_type' };
  const L = b.lottery || {};
  const email = str(L.email, 80).toLowerCase();
  const valid = !!email && EMAIL_RE.test(email);
  const wantDraw = valid && L.draw !== false; // 舊版前端沒有 draw 欄位時視為參加
  const wantEarly = valid && L.early === true;
  r.lottery = wantDraw;
  const ts = new Date();
  r.ts = ts.toISOString();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet('resp');
    const row = [ts, r.type, r.axes.ho, r.axes.pf, r.axes.sg].concat(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => r.quiz['q' + i]),
      [r.profile.role, r.profile.age, r.profile.area, r.profile.years, r.profile.transport, r.profile.live,
        join(r.weekend), r.newPlaces, join(r.barriers), join(r.motivators)],
      [1, 2, 3, 4].map((i) => r.likert['l' + i]),
      [join(r.decide), r.duration, r.open.wasted, r.open.trigger, r.open.other, r.pocket.length,
        wantDraw ? '是' : '否', r.secs, JSON.stringify(r)]);
    sh.appendRow(row.map(safe));
    if (r.pocket.length) {
      const ps = sheet('pocket');
      r.pocket.forEach((x) => ps.appendRow([ts, x.name, r.type, r.profile.role].map(safe)));
    }
    if (wantDraw || wantEarly) {
      // 只記日期、插在隨機位置：時間和順序都對不回是哪一份答案
      const lot = sheet('lot'), pos = 1 + Math.floor(Math.random() * lot.getLastRow());
      lot.insertRowAfter(pos);
      lot.getRange(pos + 1, 1, 1, 4).setValues([[Utilities.formatDate(ts, 'Asia/Taipei', 'yyyy-MM-dd'), safe(email),
        wantDraw ? '是' : '否', wantEarly ? '是' : '否']]);
    }
    return { ok: true, no: sh.getLastRow() - 1, stats: stats() };
  } finally { lock.releaseLock(); }
}

function stats() {
  const sh = sheet('resp');
  const n = sh.getLastRow() - 1;
  const types = {};
  if (n > 0) sh.getRange(2, 2, n, 1).getValues().forEach((row) => { types[row[0]] = (types[row[0]] || 0) + 1; });
  return { total: Math.max(0, n), types: types };
}
function listResponses() {
  const sh = sheet('resp');
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  const col = SHEETS.resp.head.length;
  return sh.getRange(2, col, n, 1).getValues().map((row) => { try { return JSON.parse(row[0]); } catch (e) { return null; } }).filter(Boolean);
}
function lotteryState() {
  const lot = sheet('lot'), win = sheet('win');
  const rows = lot.getLastRow() > 1 ? lot.getRange(2, 1, lot.getLastRow() - 1, 4).getValues() : [];
  const norm = (e) => String(e).replace(/^'/, '').toLowerCase().trim();
  const drawPool = Array.from(new Set(rows.filter((r) => r[2] !== '否').map((r) => norm(r[1])).filter(Boolean)));
  const early = new Set(rows.filter((r) => r[3] === '是').map((r) => norm(r[1])).filter(Boolean)).size;
  const winners = win.getLastRow() > 1 ? win.getRange(2, 1, win.getLastRow() - 1, 3).getValues()
    .map((r) => ({ at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), email: norm(r[1]), round: r[2] })) : [];
  return { entries: rows.length, unique: drawPool.length, early: early, pool: drawPool, winners: winners };
}
function draw(n) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const s = lotteryState();
    const won = new Set(s.winners.map((w) => w.email));
    const pool = s.pool.filter((e) => !won.has(e));
    const k = Math.min(Math.max(1, int(n, 1, 50) || 1), pool.length);
    const round = (s.winners.reduce((m, w) => Math.max(m, Number(w.round) || 0), 0)) + 1;
    const picked = [];
    for (let i = 0; i < k; i++) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const now = new Date();
    picked.forEach((e) => sheet('win').appendRow([now, safe(e), round]));
    const after = lotteryState();
    return { ok: true, picked: picked, round: round, unique: after.unique, winners: after.winners };
  } finally { lock.releaseLock(); }
}

// 後台密碼：沒設定或太短就一律拒絕；錯太多次暫時鎖住，防止被猜密碼
function authed(key) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('fails') || 0);
  if (fails >= MAX_LOGIN_FAILS) return 'locked';
  const k = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (k && k.length >= 12 && typeof key === 'string' && key === k) return 'ok';
  cache.put('fails', String(fails + 1), 900);
  return 'no';
}
function doGet(e) {
  if (e && e.parameter && e.parameter.stats) return out(stats());
  return out({ ok: true });
}
function doPost(e) {
  const raw = (e && e.postData && e.postData.contents) || '';
  if (raw.length > 20000) return out({ ok: false, error: 'too_large' });
  let b;
  try { b = JSON.parse(raw); } catch (err) { return out({ ok: false, error: 'bad_json' }); }
  if (b.action) {
    const a = authed(b.key);
    if (a === 'locked') return out({ ok: false, error: 'locked' });
    if (a !== 'ok') return out({ ok: false, error: 'unauthorized' });
    if (b.action === 'list') return out({ ok: true, responses: listResponses() });
    if (b.action === 'lottery') { const s = lotteryState(); return out({ ok: true, entries: s.entries, unique: s.unique, early: s.early, winners: s.winners }); }
    if (b.action === 'draw') return out(draw(b.n));
    return out({ ok: false, error: 'unknown_action' });
  }
  return out(saveResponse(b));
}
