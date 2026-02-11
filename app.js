// ================= TELEGRAM =================
const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

const tgUser = tg.initDataUnsafe?.user;

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
  updateDoc,
  onSnapshot,
  increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "tele-follow.firebaseapp.com",
  projectId: "tele-follow",
  storageBucket: "tele-follow.firebasestorage.app",
  messagingSenderId: "311701431089",
  appId: "1:311701431089:web:fcba431dcae893a87cc610"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= USER =================
const userId = String(tgUser.id);
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
      lastCheckin: null,
      streak: 0,
      createdAt: new Date()
    });
    console.log("✅ User created");
  }
}
initUser();

// ================= LIVE DATA =================
let countdownInterval = null;

onSnapshot(userRef, (snap) => {
  if (!snap.exists()) return;

  const data = snap.data();

  // الرصيد
  const balanceEl = document.getElementById("balance");
  if (balanceEl) {
    balanceEl.innerHTML = `${Number(data.usdt).toFixed(2)} <small>USDT</small>`;
    balanceEl.style.transform = "scale(1.1)";
    setTimeout(() => balanceEl.style.transform = "scale(1)", 300);
  }

  // المستوى
  const levelEl = document.getElementById("level");
  if (levelEl) levelEl.innerText = "LV " + data.level;

  // الإحالات
  const referralsEl = document.getElementById("referrals");
  if (referralsEl) referralsEl.innerText = data.referrals;

  // حظر
  if (data.banned) {
    alert("🚫 حسابك محظور");
    tg.close();
  }

  // تشغيل العداد بناءً على آخر تسجيل
  startCountdown(data.lastCheckin);
});

// ================= DAILY CHECK-IN 24H SYSTEM =================

const checkinBtn = document.querySelector(".checkin");
const countdownEl = document.getElementById("countdown");

function startCountdown(lastCheckin) {

  if (!countdownEl) return;

  // إيقاف أي عداد سابق
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (!lastCheckin) {
    countdownEl.innerText = "🔥 يمكنك التسجيل الآن";
    return;
  }

  const lastDate = new Date(lastCheckin);
  const nextTime = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);

  function updateTimer() {

    const now = new Date();
    const diff = nextTime - now;

    if (diff <= 0) {
      countdownEl.innerText = "🔥 يمكنك التسجيل الآن";
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }

    const h = Math.floor(diff / 1000 / 60 / 60);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);

    countdownEl.innerText = `⏳ المتبقي ${h}h ${m}m ${s}s`;
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

// ================= CHECK-IN BUTTON =================

if (checkinBtn) {
  checkinBtn.onclick = async () => {

    const snap = await getDoc(userRef);
    const data = snap.data();

    const now = new Date();
    const last = data.lastCheckin ? new Date(data.lastCheckin) : null;

    // تحقق 24 ساعة
    if (last) {
      const diff = now - last;
      if (diff < 24 * 60 * 60 * 1000) {
        alert("⏳ لم تمر 24 ساعة بعد");
        return;
      }
    }

    let newStreak = 1;

    if (last) {
      const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak = (data.streak || 0) + 1;
      }
    }

    let reward = 0.10 * newStreak;

    // بونس 5 أيام
    if (newStreak === 5) {
      reward += 1;
      newStreak = 0;

      tg.showPopup({
        title: "🔥 BONUS",
        message: "مكافأة 5 أيام متتالية +1 USDT",
        buttons: [{ type: "ok" }]
      });
    }

    await updateDoc(userRef, {
      usdt: increment(reward),
      lastCheckin: now,
      streak: newStreak
    });

    alert(`🎉 تم إضافة ${reward.toFixed(2)} USDT`);
  };
}

// ================= INVITE SYSTEM =================

const inviteBtn = document.querySelector(".invite");

if (inviteBtn) {
  inviteBtn.onclick = () => {
    const botUsername = "gdkmgkdbot";
    const inviteLink = `https://t.me/${botUsername}?start=${userId}`;

    tg.showPopup({
      title: "رابط الدعوة",
      message: inviteLink,
      buttons: [{ type: "close" }]
    });
  };
}

// ================= WITHDRAW =================

const withdrawBtn = document.querySelector(".primary");

if (withdrawBtn) {
  withdrawBtn.onclick = () => {
    window.location.href = "withdraw.html";
  };
}
