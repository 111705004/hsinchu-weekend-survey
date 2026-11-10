/**
 * 新竹人週末調查：Google Apps Script 後端（貼到試算表的「擴充功能 → Apps Script」）。
 *
 * 試算表會有四個分頁：
 *   回覆       每份問卷一列（不含 Email），最後一欄是原始 JSON，後台用它畫圖
 *   口袋名單   每間店一列，方便團隊直接整理
 *   抽獎名單   只有時間和 Email，跟答案分開存，看不出哪份答案是誰的
 *   中獎紀錄   每次在後台抽獎的結果
 *
 * 設定：專案設定 → 指令碼屬性 → 新增 ADMIN_KEY（後台登入用的密碼）。
 * 部署：部署 → 新增部署作業 → 網頁應用程式；執行身分「我」，存取權「所有人」。
 */

const SHEETS = {
  resp: { name: '回覆', head: ['時間', '類型', '出門軸', '計畫軸', '揪團軸', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9',
    '身分', '年齡', '居住區', '在新竹多久', '交通', '同住', '週末在做什麼', '上月新地點', '不出門原因', '出門誘因',
    'l1 兩點一線', 'l2 想認識新竹', 'l3 希望有人告訴我去哪', 'l4 想要附近小出走', '怎麼決定去哪', '願意花多久',
    '浪費週末的時刻', '什麼情況會出門', '其他原因', '口袋名單數', '同意公開店家', '有參加抽獎', '來源', '填答秒數', 'JSON'] },
  pocket: { name: '口袋名單', head: ['時間', '店名', '類型', '區域', '推薦理由', '同意公開', '填答者類型', '填答者身分'] },
  lot: { name: '抽獎名單', head: ['日期', 'Email'] },
  win: { name: '中獎紀錄', head: ['抽出時間', 'Email', '第幾輪'] },
};
const TYPE_CODES = ['HPS', 'HPG', 'HFS', 'HFG', 'OPS', 'OPG', 'OFS', 'OFG'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
/** 第一次可以手動執行一次，把四個分頁建好。 */
function setup() { Object.keys(SHEETS).forEach(sheet); }

// ── 清理輸入：白名單＋長度限制 ──
const str = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return isFinite(n) && n >= lo && n <= hi ? n : null; };
const arr = (a, max, len) => (Array.isArray(a) ? a : []).slice(0, max).map((s) => str(s, len)).filter(String);
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
    pocket: (Array.isArray(b.pocket) ? b.pocket : []).slice(0, 3).map((x) => ({
      name: str(x && x.name, 40), cat: str(x && x.cat, 12), area: str(x && x.area, 40), why: str(x && x.why, 120) })).filter((x) => x.name),
    pocketConsent: b.pocketConsent === true,
    src: str(b.src, 24), secs: int(b.secs, 0, 7200),
  };
}
const join = (a) => (a || []).join('|');

function saveResponse(b) {
  if (b.website) return { ok: true }; // 機器人陷阱欄位：有填就假裝成功、不存
  const r = clean(b);
  if (!r.type) return { ok: false, error: 'bad_type' };
  const email = b.lottery && str(b.lottery.email, 80).toLowerCase();
  const inLottery = !!(email && EMAIL_RE.test(email));
  r.lottery = inLottery;
  const ts = new Date();
  r.ts = ts.toISOString();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet('resp');
    sh.appendRow([ts, r.type, r.axes.ho, r.axes.pf, r.axes.sg].concat(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => r.quiz['q' + i]),
      [r.profile.role, r.profile.age, r.profile.area, r.profile.years, r.profile.transport, r.profile.live,
        join(r.weekend), r.newPlaces, join(r.barriers), join(r.motivators)],
      [1, 2, 3, 4].map((i) => r.likert['l' + i]),
      [join(r.decide), r.duration, r.open.wasted, r.open.trigger, r.open.other, r.pocket.length, r.pocketConsent ? '是' : '否',
        inLottery ? '是' : '否', r.src, r.secs, JSON.stringify(r)]));
    if (r.pocket.length) {
      const ps = sheet('pocket');
      r.pocket.forEach((x) => ps.appendRow([ts, x.name, x.cat, x.area, x.why, r.pocketConsent ? '是' : '否', r.type, r.profile.role]));
    }
    if (inLottery) {
      // 只記日期、插在隨機位置：時間和順序都對不回是哪一份答案
      const lot = sheet('lot'), pos = 1 + Math.floor(Math.random() * lot.getLastRow());
      lot.insertRowAfter(pos);
      lot.getRange(pos + 1, 1, 1, 2).setValues([[Utilities.formatDate(ts, 'Asia/Taipei', 'yyyy-MM-dd'), email]]);
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
  const emails = lot.getLastRow() > 1 ? lot.getRange(2, 2, lot.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).toLowerCase().trim()) : [];
  const unique = Array.from(new Set(emails.filter(Boolean)));
  const winners = win.getLastRow() > 1 ? win.getRange(2, 1, win.getLastRow() - 1, 3).getValues()
    .map((r) => ({ at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), email: String(r[1]), round: r[2] })) : [];
  return { entries: emails.length, unique: unique.length, pool: unique, winners: winners };
}
function draw(n) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const s = lotteryState();
    const won = new Set(s.winners.map((w) => w.email.toLowerCase()));
    const pool = s.pool.filter((e) => !won.has(e));
    const k = Math.min(Math.max(1, int(n, 1, 50) || 1), pool.length);
    const round = (s.winners.reduce((m, w) => Math.max(m, Number(w.round) || 0), 0)) + 1;
    const picked = [];
    for (let i = 0; i < k; i++) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const now = new Date();
    picked.forEach((e) => sheet('win').appendRow([now, e, round]));
    const after = lotteryState();
    return { ok: true, picked: picked, round: round, unique: after.unique, winners: after.winners };
  } finally { lock.releaseLock(); }
}

function authed(key) {
  const k = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!k && key === k;
}
function doGet(e) {
  if (e && e.parameter && e.parameter.stats) return out(stats());
  return out({ ok: true, hint: '這是問卷的資料接收端。' });
}
function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad_json' }); }
  if (b.action) {
    if (!authed(b.key)) return out({ ok: false, error: 'unauthorized' });
    if (b.action === 'list') return out({ ok: true, responses: listResponses() });
    if (b.action === 'lottery') { const s = lotteryState(); return out({ ok: true, entries: s.entries, unique: s.unique, winners: s.winners }); }
    if (b.action === 'draw') return out(draw(b.n));
    return out({ ok: false, error: 'unknown_action' });
  }
  return out(saveResponse(b));
}
