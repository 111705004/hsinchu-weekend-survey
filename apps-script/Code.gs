/**
 * @OnlyCurrentDoc
 * 新竹人心理測驗：Google Apps Script 後端（貼到試算表的「擴充功能 → Apps Script」）。
 *
 * 試算表會有五個分頁（另有「欄位說明」解釋每一欄）：
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
/** 第一次手動執行一次，把分頁建好；之後再執行也安全，只會更新「欄位說明」。 */
function setup() { Object.keys(SHEETS).forEach(sheet); writeGuide(); }
// ── 欄位說明分頁：給看不懂代碼的隊友 ──
const GUIDE = [
  ['分頁', '欄位', '意思', '怎麼看'],
  ['回覆', '時間', '送出測驗的時間', ''],
  ['回覆', '類型', '測出來的新竹人類型代碼', 'HPS 週末Debug工程師、HPG 流團發起人、HFS 九降風避難者、HFG 群組潛水王、OPS 城市速通者、OPG 新竹人肉導遊、OFS 貢丸漂流者、OFG 巨城無限迴圈'],
  ['回覆', '出門軸', '心理測驗 q1–q3 的加總', '-3 超宅、-1 偏宅、+1 偏愛出門、+3 超愛出門'],
  ['回覆', '計畫軸', '心理測驗 q4–q6 的加總', '-3 超隨興、+3 超愛計畫'],
  ['回覆', '揪團軸', '心理測驗 q7–q9 的加總', '-3 超獨行、+3 超愛揪團'],
  ['回覆', 'q1–q9', '心理測驗每題選了哪個選項', '0=A、1=B、2=C、3=D，題目見下方'],
  ['回覆', '身分、年齡、居住區、在新竹多久、交通、同住', '基本資料', '直接是選項文字'],
  ['回覆', '週末在做什麼', '過去一個月週末做的事（複選）', '多個答案用 | 隔開'],
  ['回覆', '上月新地點', '上個月去了幾次沒去過的地方', '0 次／1 次／2–3 次／4 次以上'],
  ['回覆', '不出門原因', '週末不出門的原因（最多 3 個）', '用 | 隔開'],
  ['回覆', '出門誘因', '什麼會讓他更想出門（最多 3 個）', '用 | 隔開'],
  ['回覆', 'l1 兩點一線', '「我的生活大致是公司／學校和家兩點一線」', '1 非常不同意 … 5 非常同意'],
  ['回覆', 'l2 想認識新竹', '「我想多認識新竹，但不知道從哪裡開始」', '1–5，同上'],
  ['回覆', 'l3 希望有人告訴我去哪', '「我希望有人直接告訴我這個週末可以去哪」', '1–5，同上'],
  ['回覆', 'l4 想要附近小出走', '「比起長途旅行，我更想要住家附近 1–2 小時的小出走」', '1–5，同上'],
  ['回覆', '怎麼決定去哪', '平常靠什麼決定去哪（複選）', '用 | 隔開'],
  ['回覆', '願意花多久', '一趟在地小出走願意花的時間', ''],
  ['回覆', '浪費週末的時刻、什麼情況會出門、其他原因', '開放式回答', '可直接引用當質化資料'],
  ['回覆', '推薦店家數', '這個人推薦了幾間店', '0–3'],
  ['回覆', '有參加抽獎', '有沒有留 Email 參加抽獎', '是／否（Email 本身不在這個分頁）'],
  ['回覆', '填答秒數', '從開始到送出花了幾秒', '不到 60 秒的可能是亂填'],
  ['回覆', 'JSON', '整份答案的原始資料，後台畫圖用', '不用看，也不要改'],
  ['口袋名單', '時間、店名、填答者類型、填答者身分', '每推薦一間店一列', ''],
  ['抽獎名單', '日期、Email、參加抽獎、搶先體驗', '留了 Email 的人', '順序是打亂的，對不回哪份答案；只分享給負責寄獎的人'],
  ['中獎紀錄', '抽出時間、Email、第幾輪', '後台按「抽出得主」的結果', ''],
  ['', '', '', ''],
  ['心理測驗題目', '題號', '題目', '選項代碼'],
  ['心理測驗題目', "q1", "週六早上 10 點醒來，你第一件事是？", "0=確認今天不用出門，翻身繼續睡；1=打開外送 app 研究早午餐；2=傳訊息問朋友「今天要幹嘛」；3=人已經在南寮吹海風了"],
  ['心理測驗題目', "q2", "九降風吹到機車快要飛走，你會？", "0=天意如此，今天在家；1=叫外送，讓外送員替我出門；2=風城人不怕風，戴好安全帽出發；3=改去室內，總之要出門"],
  ['心理測驗題目', "q3", "外縣市朋友說「我們來新竹找你玩！」你的第一反應？", "0=「新竹？你們確定？」；1=約我家，米粉貢丸外送我請；2=先 Google「新竹 景點」臨時抱佛腳；3=終於！我有一堆私房景點想帶人去"],
  ['心理測驗題目', "q4", "你的 Google Maps 星號清單長怎樣？", "0=分類整齊，還寫了備註；1=存了 300 個，去過 3 個；2=沒在存，想到再搜；3=星號是什麼？我都靠路上看到"],
  ['心理測驗題目', "q5", "週末要出門，你的行程表長怎樣？", "0=試算表，精確到分鐘；1=大概想好兩個點；2=出門再說；3=行程表？可以吃嗎"],
  ['心理測驗題目', "q6", "到了想去的店，結果今天公休？", "0=不可能，我出門前查過營業時間；1=立刻打開備案 B；2=那就亂晃，說不定有新發現；3=宇宙叫我回家，那就回家"],
  ['心理測驗題目', "q7", "最理想的週末夥伴是？", "0=自己，一個人最自在；1=耳機和一杯咖啡；2=兩三個熟朋友；3=人越多越好，我來開團"],
  ['心理測驗題目', "q8", "咖啡廳隔壁桌的人看到你點的甜點，跟你搭話，你會？", "0=微笑點頭，然後低頭滑手機；1=假裝在講電話；2=聊起來，順便交換口袋名單；3=聊到最後加了 IG"],
  ['心理測驗題目', "q9", "LINE 群組有人說「這週末要不要出去？」", "0=已讀；1=回一張貼圖然後消失；2=「好啊，去哪？」；3=我就是發這句的人"],
];
/** 建立或更新「欄位說明」分頁。 */
function writeGuide() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('欄位說明') || ss.insertSheet('欄位說明', 0);
  sh.clear();
  sh.getRange(1, 1, GUIDE.length, 4).setValues(GUIDE).setWrap(true).setVerticalAlignment('top');
  sh.getRange(1, 1, 1, 4).setFontWeight('bold');
  sh.getRange(GUIDE.findIndex((r) => r[1] === '題號') + 1, 1, 1, 4).setFontWeight('bold');
  sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 220); sh.setColumnWidth(3, 320); sh.setColumnWidth(4, 520);
  sh.setFrozenRows(1);
}


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
