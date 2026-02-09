const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user;

if (user) {
  document.getElementById("balance").innerHTML = "0.25 <small>USDT</small>";
}
