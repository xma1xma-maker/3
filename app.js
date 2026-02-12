// ================= TELEGRAM =================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
const tgUser = tg.initDataUnsafe?.user;

// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, increment, collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ", authDomain: "tele-follow.firebaseapp.com", projectId: "tele-follow", storageBucket: "tele-follow.firebasestorage.app", messagingSenderId: "311701431089", appId: "1:311701431089:web:fcba431dcae893a87cc610" };
const app = initializeApp(firebaseConfig );
const db = getFirestore(app);
const auth = getAuth(app);

// ================= USER & APP STATE =================
let userId = null;
let userRef = null;
let hasSharedToday = false;
let currentUserData = null;

// ================= CUSTOM MODAL FUNCTION =================
const modalOverlay = document.getElementById('custom-modal');
const modalContent = document.querySelector('.modal-content');
const modalIcon = document.getElementById('modal-icon');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

function showModal(message, type = 'success') {
    if (!modalOverlay) return;
    const icons = { success: 'ri-checkbox-circle-fill', warning: 'ri-error-warning-fill', error: 'ri-close-circle-fill' };
    modalContent.className = `modal-content ${type}`;
    modalIcon.className = icons[type];
    modalMessage.innerText = message;
    modalOverlay.classList.add('show');
}

if (modalCloseBtn) {
    modalCloseBtn.onclick = () => {
        modalOverlay.classList.remove('show');
    };
}

// ================= APP INITIALIZATION (نقطة البداية الجديدة) =================
async function startApp() {
    try {
        // 1. المصادقة أولاً وقبل كل شيء
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        userId = user.uid;
        userRef = doc(db, "users", userId);

        // 2. تهيئة المستخدم (هذه الخطوة مشتركة لكل الصفحات)
        await initUser();
        
        // 3. تشغيل الوظائف بناءً على الصفحة الحالية
        route();

    } catch (error) {
        console.error("Firebase Authentication Error: ", error);
        showModal("حدث خطأ في الاتصال بالخادم. الرجاء إعادة تحميل الصفحة.", "error");
    }
}
startApp(); // بدء تشغيل التطبيق

// ================= ROUTER (الموجه الجديد) =================
function route() {
    const path = window.location.pathname;

    // دوال تعمل على كل الصفحات
    setupLiveListeners();
    setupInviteButtons(); // أزرار الدعوة قد تكون في أكثر من صفحة

    // دوال تعمل حسب الصفحة
    if (path.includes('index.html') || path === '/') {
        // لا يوجد دوال خاصة بالصفحة الرئيسية حالياً
    } else if (path.includes('profile.html')) {
        setupNavigation();
    } else if (path.includes('withdraw.html')) {
        setupWithdrawalSystem();
    } else if (path.includes('leaderboard.html')) {
        fetchLeaderboard();
    }
}

// ================= INIT USER =================
async function initUser() {
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
        authUid: userId,
        telegramId: tgUser ? String(tgUser.id) : "TEST_USER",
        username: tgUser?.username || tgUser?.first_name || "Test User",
        usdt: 0, localCoin: 0, level: 1, tasksCompleted: 0, referrals: 0,
        banned: false, lastCheckin: null, streak: 0, createdAt: new Date()
    });
  }
}

// ================= LIVE DATA (GLOBAL) =================
function setupLiveListeners() {
    // هذا المستمع يجب أن يعمل في كل الصفحات لتحديث البيانات المشتركة
    onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return;
        currentUserData = snap.data();
        
        // تحديث العناصر المشتركة بين الصفحات (إذا وجدت)
        updateElement("username", currentUserData.username);
        updateElement("user-initial", currentUserData.username.charAt(0).toUpperCase());
        updateElement("user-id-display", currentUserData.telegramId);
        updateElement("balance", Number(currentUserData.usdt).toFixed(2));
        updateElement("local-coin", Number(currentUserData.localCoin).toFixed(1));
        updateElement("tasks-completed", currentUserData.tasksCompleted);
        updateElement("referrals", currentUserData.referrals);
        updateElement("level", `LV.${currentUserData.level}`);
        updateElement("streak-info", `إجمالي ${currentUserData.streak || 0} يوم | تسلسل ${currentUserData.streak || 0} يوم`);
        
        const progress = (currentUserData.usdt % 100);
        const levelProgressEl = document.getElementById("level-progress");
        if (levelProgressEl) levelProgressEl.style.width = `${progress}%`;
        
        if (currentUserData.banned) { showModal("حسابك محظور", "error"); tg.close(); }
        
        // تشغيل العداد فقط إذا كان العنصر موجوداً في الصفحة
        if (document.getElementById("countdown")) {
            startCountdown(currentUserData.lastCheckin);
        }
    });
}

function updateElement(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

// ================= DAILY CHECK-IN =================
const checkinBtn = document.getElementById("checkin-btn");
const countdownEl = document.getElementById("countdown");
let countdownInterval = null;
let canCheckin = false;

function startCountdown(lastCheckin) {
  if (!countdownEl || !checkinBtn) return;
  if (countdownInterval) clearInterval(countdownInterval);
  const nextTime = lastCheckin ? new Date(new Date(lastCheckin.toDate()).getTime() + 24 * 60 * 60 * 1000) : new Date();
  function updateTimer() {
    const now = new Date();
    const diff = nextTime - now;
    if (diff <= 0) {
      canCheckin = true;
      countdownEl.innerText = "تسجيل الحضور";
      checkinBtn.disabled = false;
      clearInterval(countdownInterval);
      return;
    }
    canCheckin = false;
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
    if (!canCheckin) { showModal("لم تمر 24 ساعة على آخر مكافأة.", "warning"); return; }
    if (!hasSharedToday) { showModal("يجب عليك مشاركة رابط الدعوة أولاً للحصول على المكافأة اليومية.", "warning"); return; }
    await updateDoc(userRef, { usdt: increment(0.1), lastCheckin: new Date(), streak: increment(1) });
    hasSharedToday = false;
    showModal("🎉 رائع! لقد حصلت على 0.1 USDT كمكافأة تسجيل حضور!", "success");
  };
}

// ================= INVITE SYSTEM =================
function setupInviteButtons() {
    const createInviteHandler = (botUsername) => {
        return () => {
            if (!tgUser) { showModal("يجب فتح التطبيق من داخل تيليجرام.", "error"); return; }
            const inviteLink = `https://t.me/${botUsername}?start=${userId}`;
            hasSharedToday = true;
            showModal("شكراً لمشاركتك! يمكنك الآن المطالبة بمكافأتك اليومية.", "success"  );
            tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink )}&text=${encodeURIComponent("انضم إلى هذا البوت الرائع واحصل على مكافآت!")}`);
        };
    };
    const botUsername = "gdkmgkdbot";
    const inviteHandler = createInviteHandler(botUsername);
    const inviteButtons = document.querySelectorAll(".invite-btn");
    inviteButtons.forEach(btn => { btn.onclick = inviteHandler; });
}

// ================= NAVIGATION HELPERS =================
function setupNavigation() {
    const goToWithdrawBtn = document.getElementById('go-to-withdraw-btn');
    if (goToWithdrawBtn) {
        goToWithdrawBtn.onclick = () => {
            window.location.href = 'withdraw.html';
        };
    }
}

// ================= WITHDRAWAL SYSTEM =================
function setupWithdrawalSystem() {
    const withdrawBtn = document.getElementById('withdraw-btn');
    const amountInput = document.getElementById('amount');
    const walletInput = document.getElementById('wallet');

    if (withdrawBtn) {
        withdrawBtn.onclick = async () => {
            const amount = parseFloat(amountInput.value);
            const wallet = walletInput.value.trim();
            const minWithdrawal = 10;

            if (isNaN(amount) || amount <= 0) { showModal("الرجاء إدخال مبلغ صحيح.", "warning"); return; }
            if (wallet === "") { showModal("الرجاء إدخال عنوان المحفظة.", "warning"); return; }
            if (amount < minWithdrawal) { showModal(`الحد الأدنى للسحب هو ${minWithdrawal} USDT.`, "warning"); return; }
            if (!currentUserData || currentUserData.usdt < amount) { showModal("رصيدك الحالي غير كافٍ.", "error"); return; }

            withdrawBtn.disabled = true;
            withdrawBtn.innerText = "الرجاء الانتظار...";

            try {
                const withdrawalsCollection = collection(db, "withdrawals");
                await addDoc(withdrawalsCollection, {
                    userId: userId,
                    username: currentUserData.username,
                    amount: amount,
                    wallet: wallet,
                    status: "pending",
                    createdAt: serverTimestamp()
                });
                await updateDoc(userRef, { usdt: increment(-amount) });
                showModal("✅ تم إرسال طلب السحب بنجاح!", "success");
                amountInput.value = "";
                walletInput.value = "";
            } catch (error) {
                console.error("Error processing withdrawal: ", error);
                showModal("حدث خطأ أثناء إرسال الطلب.", "error");
            } finally {
                withdrawBtn.disabled = false;
                withdrawBtn.innerText = "إرسال طلب السحب";
            }
        };
    }
}

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
        item.innerHTML = `<div class="rank">${rank}</div><div class="avatar" style="background-color: ${stringToColor(userData.username)}"><span>${userData.username.charAt(0).toUpperCase()}</span></div><div class="user-info"><h4>${userData.username}</h4><small>LV. ${userData.level}</small></div><div class="user-score"><span>${Number(userData.usdt).toFixed(2)}</span><i class="ri-wallet-3-line"></i></div>`;
        leaderboardList.appendChild(item);
        rank++;
    });
}

// ================= HELPERS =================
function stringToColor(str) {
  if (!str) return '#8b949e';
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  let color = '#';
  for (let i = 0; i < 3; i++) { let value = (hash >> (i * 8)) & 0xFF; color += ('00' + value.toString(16)).substr(-2); }
  return color;
}
