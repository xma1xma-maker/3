// ================= TELEGRAM =================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const tgUser = tg.initDataUnsafe?.user;

if (!tgUser) {
  // استخدم هذا التنبيه لتجربة التطبيق في المتصفح العادي
  // alert("❌ افتح التطبيق من داخل Telegram فقط");
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
  increment,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ",
  authDomain: "tele-follow.firebaseapp.com",
  projectId: "tele-follow",
  storageBucket: "tele-follow.firebasestorage.app",
  messagingSenderId: "311701431089",
  appId: "1:311701431089:web:fcba431dcae893a87cc610"
};

const app = initializeApp(firebaseConfig );
const db = getFirestore(app);

// ================= USER =================
// استخدم ID حقيقي من تيليجرام أو ID وهمي للتجربة في المتصفح
const userId = tgUser ? String(tgUser.id) : "123456789_TEST";
const userRef = doc(db, "users", userId);

// ================= INIT USER =================
async function initUser() {
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      telegramId: userId,
      username: tgUser?.username || tgUser?.first_name || "Test User",
      usdt: 0,
      localCoin: 0, // عملة داخلية جديدة
      level: 1,
      tasksCompleted: 0, // مهام مكتملة
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

// ================= LIVE DATA (GLOBAL) =================
onSnapshot(userRef, (snap) => {
  if (!snap.exists()) return;
  const data = snap.data();

  // تحديث كل العناصر التي تحمل ID مطابق
  updateElement("username", data.username);
  updateElement("user-initial", data.username.charAt(0).toUpperCase());
  updateElement("user-id-display", data.telegramId);
  
  updateElement("balance", Number(data.usdt).toFixed(2));
  updateElement("local-coin", Number(data.localCoin).toFixed(1));
  updateElement("tasks-completed", data.tasksCompleted);
  updateElement("referrals", data.referrals);
  
  updateElement("level", `LV.${data.level}`);
  updateElement("streak-info", `إجمالي ${data.streak || 0} يوم | تسلسل ${data.streak || 0} يوم`);

  const progress = (data.usdt % 100);
  const levelProgressEl = document.getElementById("level-progress");
  if (levelProgressEl) levelProgressEl.style.width = `${progress}%`;

  if (data.banned) {
    alert("🚫 حسابك محظور");
    tg.close();
  }

  startCountdown(data.lastCheckin);
});

function updateElement(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

// ================= DAILY CHECK-IN =================
const checkinBtn = document.getElementById("checkin-btn");
const countdownEl = document.getElementById("countdown");
let countdownInterval = null;

function startCountdown(lastCheckin) {
  if (!countdownEl || !checkinBtn) return;
  if (countdownInterval) clearInterval(countdownInterval);

  const nextTime = lastCheckin ? new Date(new Date(lastCheckin.toDate()).getTime() + 24 * 60 * 60 * 1000) : new Date();

  function updateTimer() {
    const now = new Date();
    const diff = nextTime - now;

    if (diff <= 0) {
      countdownEl.innerText = "تسجيل الحضور";
      checkinBtn.disabled = false;
      clearInterval(countdownInterval);
      return;
    }
    
    checkinBtn.disabled = true;
    const h = Math.floor(diff / 1000 / 60 / 60);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    countdownEl.innerText = `⏳ ${h}h ${m}m ${s}s`;
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

if (checkinBtn) {
  checkinBtn.onclick = async () => {
    await updateDoc(userRef, {
      usdt: increment(0.1),
      lastCheckin: new Date(),
      streak: increment(1)
    });
    tg.showPopup({ title: "✅ تم", message: "لقد حصلت على 0.1 USDT كمكافأة تسجيل حضور!", buttons: [{ type: "ok" }] });
  };
}

// ================= INVITE SYSTEM (UPDATED) =================
function setupInviteButtons() {
    const createInviteHandler = (botUsername, userId) => {
        return () => {
            if (!tgUser) {
                alert("يجب فتح التطبيق من داخل تيليجرام لاستخدام هذه الميزة.");
                return;
            }
            const inviteLink = `https://t.me/${botUsername}?start=${userId}`;
            tg.showPopup({
                title: "رابط الدعوة الخاص بك",
                message: `شارك هذا الرابط مع أصدقائك:\n\n${inviteLink}`,
                buttons: [{ id: 'copy', type: 'default', text: 'نسخ الرابط' }, { type: 'close' }]
            } );
        };
    };

    const botUsername = "gdkmgkdbot"; // تأكد من صحة اسم البوت
    const inviteHandler = createInviteHandler(botUsername, userId);

    const inviteButtons = document.querySelectorAll(".invite-btn");
    inviteButtons.forEach(btn => {
        btn.onclick = inviteHandler;
    });

    tg.onEvent('popupClosed', (data) => {
        if (data.button_id === 'copy') {
            const inviteLink = `https://t.me/${botUsername}?start=${userId}`;
            navigator.clipboard.writeText(inviteLink ).then(() => {
                tg.showAlert('✅ تم النسخ بنجاح!');
            }).catch(err => {
                tg.showAlert('❌ فشل النسخ');
            });
        }
    });
}
setupInviteButtons();


// ================= LEADERBOARD =================
const leaderboardList = document.getElementById("leaderboard-list");

async function fetchLeaderboard() {
    if (!leaderboardList) return;

    const usersCollection = collection(db, "users");
    const q = query(usersCollection, orderBy("usdt", "desc"), limit(20));
    const querySnapshot = await getDocs(q);

    leaderboardList.innerHTML = "";
    let rank = 1;
    querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        const item = document.createElement("div");
        item.className = "leaderboard-item";
        item.innerHTML = `
            <div class="rank">${rank}</div>
            <div class="avatar" style="background-color: ${stringToColor(userData.username)}"><span>${userData.username.charAt(0).toUpperCase()}</span></div>
            <div class="user-info">
                <h4>${userData.username}</h4>
                <small>LV. ${userData.level}</small>
            </div>
            <div class="user-score">
                <span>${Number(userData.usdt).toFixed(2)}</span>
                <i class="ri-wallet-3-line"></i>
            </div>
        `;
        leaderboardList.appendChild(item);
        rank++;
    });
}
fetchLeaderboard();

function stringToColor(str) {
  if (!str) return '#8b949e';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}
