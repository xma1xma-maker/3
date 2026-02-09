const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user;

if (user) {
  console.log("Telegram User:", user);
  // لاحقًا نربط Firebase
  document.getElementById("balance").innerText = "0.20 USDT";
}
