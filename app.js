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
onSnapshot(userRef, (snap) => {
  if (!snap.exists()) return;

  const data = snap.data();

  // الرصيد + أنيميشن
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
});

// ================= DAILY CHECK-IN PRO =================

const checkinBtn = document.querySelector(".checkin");
const countdownEl = document.getElementById("countdown");

function getTomorrowMidnight() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function startCountdown() {
  if (!countdownEl) return;

  setInterval(() => {
    const diff = getTomorrowMidnight() - new Date();

    if (diff <= 0) {
      countdownEl.innerText = "🔥 يمكنك التسجيل الآن";
      return;
    }

    const h = Math.floor(diff / 1000 / 60 / 60);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);

    countdownEl.innerText = `المتبقي: ${h}h ${m}m ${s}s`;
  }, 1000);
}

startCountdown();

if (checkinBtn) {
  checkinBtn.onclick = async () => {

    const snap = await getDoc(userRef);
    const data = snap.data();

    const today = new Date().toDateString();
    const last = data.lastCheckin;

    if (last === today) {
      alert("⏳ سجلت حضورك اليوم بالفعل");
      return;
    }

    let newStreak = data.streak || 0;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (last === yesterday.toDateString()) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    // المكافأة تزيد حسب الأيام
    let reward = 0.10 * newStreak;

    // بونس 5 أيام
    if (newStreak === 5) {
      reward += 1; // بونس إضافي
      newStreak = 0;
      tg.showPopup({
        title: "🔥 BONUS",
        message: "حصلت على مكافأة 5 أيام متتالية +1 USDT",
        buttons: [{ type: "ok" }]
      });
    }

    await updateDoc(userRef, {
      usdt: increment(reward),
      lastCheckin: today,
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
