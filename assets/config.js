// 部署設定。照 README 建好 Google 試算表與 Apps Script 後，把網址貼到 SCRIPT_URL。
// SCRIPT_URL 留空時，送出的答案只會暫存在該瀏覽器（方便本機測試）。
const CONFIG = {
  SCRIPT_URL: '',
  LOTTERY: {
    prize: '價值 NT$200 的神秘禮物',
    winners: 1,          // 抽出幾位
    deadline: '',        // 例如 '2026/12/15'；留空就不顯示截止日
    announce: '',        // 例如 '12/20 以 Email 通知中獎者'；留空就顯示「以 Email 通知中獎者」
  },
};
