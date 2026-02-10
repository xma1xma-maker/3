// ================= TELEGRAM =================
const tg = window.Telegram.WebApp;
tg.expand();

const tgUser = tg.initDataUnsafe?.user;

if (!tgUser) {
  alert("Telegram user not found");
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
      username: tgUser.username || tgUser.first_name,
      usdt: 0,
      level: 1,
      referrals: 0,
      banned: false,
      createdAt: new Date()
    });
  }
}

initUser();

// ================= LIVE DATA =================
onSnapshot(userRef, (snap) => {
  if (!sn
