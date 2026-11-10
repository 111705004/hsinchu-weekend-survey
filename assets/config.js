// 部署設定。照 README 建好 Google 試算表與 Apps Script 後，把網址貼到 SCRIPT_URL。
// SCRIPT_URL 留空時，送出的答案只會暫存在該瀏覽器（方便本機測試）。
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyLGn4MME8R0FhBOcaugrBN5oaQzwjocm34hwmUJTiN5XHSzZtmyqcTUK54juMO_ecFOg/exec',
  CONTACT: 'changtruda@gmail.com', // 測驗頁上「想取消搶先體驗」的聯絡信箱（會公開顯示）
  LOTTERY: {
    prize: '價值 NT$200 的神秘禮物',
    winners: 1,          // 抽出幾位
    deadline: '',        // 例如 '2026/12/15'；留空就不顯示截止日
    announce: '',        // 例如 '12/20 以 Email 通知中獎者'；留空就顯示「以 Email 通知中獎者」
  },
};
