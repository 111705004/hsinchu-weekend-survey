// 部署設定。照 README 建好 Google 試算表與 Apps Script 後，把網址貼到 SCRIPT_URL。
// SCRIPT_URL 留空時，送出的答案只會暫存在該瀏覽器（方便本機測試）。
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyLGn4MME8R0FhBOcaugrBN5oaQzwjocm34hwmUJTiN5XHSzZtmyqcTUK54juMO_ecFOg/exec',
  CONTACT: 'changtruda@gmail.com', // 測驗頁上「想取消搶先體驗」的聯絡信箱（會公開顯示）
  LOTTERY: {
    prize: '價值 NT$200 的神秘禮物',
    winners: 1,          // 抽出幾位
    deadline: '11/18',   // 抽獎截止日；留空就不顯示
    announce: '以 Email 通知中獎者', // 公布方式
  },
};
