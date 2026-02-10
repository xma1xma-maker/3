// ================= TELEGRAM =================
const tg = window.Telegram.WebApp;

// 🔴 مهم جدًا
tg.ready();
tg.expand();

const tgUser = tg.initDataUnsafe?.user;

console.log("Telegram initData:", tg.initDataUnsafe);
console.log("Telegram user:", tgUser);

if (!tgUser) {
  alert("❌ افتح التطبيق من داخل Telegram فقط");
  throw new Error("Telegram user not found");
}

// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ",
  authDomain: "tele-follow.firebaseapp.com",
  projectId: "tele-follow",
  storageBucket: "tele-follow.firebasestorage.app",
  messagingSenderId: "311701431089",
  appId: "1:311701431089:web:fcba431dcae893a87cc610"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ================= USER =================
const userId = String(tgUser.id); // 🔥 Document ID = telegramId
const userRef = doc(db, "users", userId);

// ================= INIT USER =================
async function initUser() {
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      telegramId: userId,
      username: tgUser.username || tgUser.first_name || "User",
      usdt: 0,
      level: 1,
      referrals: 0,
      banned: false,
      createdAt: new Date()
    });

    console.log("✅ User created:", userId);
  } else {
    console.log("ℹ️ User already exists:", userId);
  }
}

initUser();

// ================= LIVE DATA =================
onSnapshot(userRef, (snap) => {
  if (!snap.exists()) return;

  const data = snap.data();

  // الرصيد
  const balanceEl = document.getElementById("balance");
  if (balanceEl) {
    balanceEl.innerHTML = `${data.usdt.toFixed(2)} <small>USDT</small>`;
  }

  // المستوى
  const levelEl = document.querySelector(".level");
  if (levelEl) {
    levelEl.innerText = "LV " + data.level;
  }

  // الإحالات (أول stat)
  const referralsEl = document.querySelector(".stat b");
  if (referralsEl) {
    referralsEl.innerText = data.referrals;
  }

  // حظر
  if (data.banned) {
    alert("🚫 حسابك محظور");
    tg.close();
  }
});

// ================= BUTTONS =================
const withdrawBtn = document.querySelector(".primary");
if (withdrawBtn) {
  withdrawBtn.onclick = () => {
    window.location.href = "withdraw.html";
  };
}
