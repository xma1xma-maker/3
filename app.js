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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

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
      createdAt: new Date()
    });

    console.log("✅ User created:", userId);
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
    balanceEl.innerHTML = `${Number(data.usdt).toFixed(2)} <small>USDT</small>`;
  }

  // المستوى
  const levelEl = document.getElementById("level");
  if (levelEl) {
    levelEl.innerText = "LV " + data.level;
  }

  // الإحالات
  const referralsEl = document.getElementById("referrals");
  if (referralsEl) {
    referralsEl.innerText = data.referrals;
  }

  // حظر
  if (data.banned) {
    alert("🚫 حسابك محظور");
    tg.close();
  }
});

// ================= DAILY CHECK-IN =================
const checkinBtn = document.querySelector(".checkin");

if (checkinBtn) {
  checkinBtn.onclick = async () => {

    const snap = await getDoc(userRef);
    const data = snap.data();

    const today = new Date().toDateString();

    if (data.lastCheckin === today) {
      alert("⏳ سجلت حضورك اليوم بالفعل");
      return;
    }

    await updateDoc(userRef, {
      usdt: increment(0.10), // مكافأة يومية
      lastCheckin: today
    });

    alert("🎉 تم إضافة 0.10 USDT");
  };
}

// ================= INVITE SYSTEM =================
const inviteBtn = document.querySelector(".invite");

if (inviteBtn) {
  inviteBtn.onclick = () => {
    const botUsername = "@gdkmgkdbot";
    const inviteLink = `https://t.me/${botUsername}?start=${userId}`;

    tg.showPopup({
      title: "رابط الدعوة",
      message: inviteLink,
      buttons: [{ type: "close" }]
    });
  };
}

// ================= WITHDRAW BUTTON =================
const withdrawBtn = document.querySelector(".primary");

if (withdrawBtn) {
  withdrawBtn.onclick = () => {
    window.location.href = "withdraw.html";
  };
}
