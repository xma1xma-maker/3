// ================= TELEGRAM =================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
const tgUser = tg.initDataUnsafe?.user;

// ================= FIREBASE (تعريف المتغيرات في النطاق العام) =================
const { initializeApp } = firebase;
const { getAuth, signInAnonymously, signOut } = firebase.auth;
const { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, increment, collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } = firebase.firestore;

// ================= GLOBAL STATE =================
let db, auth;
let userId = null;
let userRef = null;
let hasSharedToday = false;
let currentUserData = null;

// ================= CUSTOM MODAL =================
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
if (modalCloseBtn) { modalCloseBtn.onclick = () => modalOverlay.classList.remove('show'); }

// ================= APP ENTRY POINT =================
async function main() {
    try {
        const firebaseConfig = { apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ", authDomain: "tele-follow.firebaseapp.com", projectId: "tele-follow", storageBucket: "tele-follow.firebasestorage.app", messagingSenderId: "311701431089", appId: "1:311701431089:web:fcba431dcae893a87cc610" };
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        const userCredential = await signInAnonymously(auth);
        userId = userCredential.user.uid;
        userRef = doc(db, "users", userId);

        await initUser();

        onSnapshot(userRef, (snap) => {
            if (!snap.exists()) return;
            currentUserData = snap.data();
            updateUI(currentUserData);
        });

        bindGlobalEvents();
        bindPageSpecificEvents();

    } catch (error) {
        console.error("Critical Error:", error);
        showModal(`خطأ حرج: ${error.message}`, "error");
    }
}

// ================= FUNCTIONS =================

async function initUser() {
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
        authUid: userId, 
        telegramId: tgUser ? String(tgUser.id) : "TEST_USER",
        username: tgUser?.username || tgUser?.first_name || "Test User",
        usdt: 0, 
        localCoin: 0, 
        level: 1, 
        tasksCompleted: 0, 
        referrals: 0,
        banned: false, 
        lastCheckin: null, 
        streak: 0, 
        createdAt: serverTimestamp() // Use serverTimestamp for consistency
    });
  }
}

function updateUI(data) {
    updateElement("username", data.username);
    updateElement("user-initial", data.username.charAt(0).toUpperCase());
    updateElement("balance", Number(data.usdt).toFixed(2));
    updateElement("local-coin", Number(data.localCoin).toFixed(1));
    updateElement("tasks-completed", data.tasksCompleted);
    updateElement("referrals", data.referrals);
    updateElement("level", `LV.${data.level}`);
    updateElement("streak-info", `إجمالي ${data.streak || 0} يوم | تسلسل ${data.streak || 0} يوم`);
    
    updateElement("profile-username", data.username);
    updateElement("profile-user-initial", data.username.charAt(0).toUpperCase());
    updateElement("profile-user-id-display", data.telegramId);
    updateElement("profile-balance", Number(data.usdt).toFixed(2));
    updateElement("profile-local-coin", Number(data.localCoin).toFixed(1));
    updateElement("profile-referrals", data.referrals);

    const progress = (data.usdt % 100);
    const levelProgressEl = document.getElementById("level-progress");
    if (levelProgressEl) levelProgressEl.style.width = `${progress}%`;
    
    if (data.banned) { showModal("حسابك محظور", "error"); tg.close(); }
    
    startCountdown(data.lastCheckin);
}

function updateElement(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function bindGlobalEvents() {
    const botUsername = "gdkmgkdbot";
    const inviteHandler = () => {
        if (!tgUser) { showModal("يجب فتح التطبيق من داخل تيليجرام.", "error"); return; }
        const inviteLink = `https://t.me/${botUsername}?start=${userId}`;
        hasSharedToday = true;
        showModal("شكراً لمشاركتك! يمكنك الآن المطالبة بمكافأتك اليومية.", "success"  );
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink )}&text=${encodeURIComponent("انضم إلى هذا البوت الرائع!")}`);
    };
    document.querySelectorAll(".invite-btn").forEach(btn => { btn.onclick = inviteHandler; });
}

function bindPageSpecificEvents() {
    const goToWithdrawBtn = document.getElementById('go-to-withdraw-btn');
    if (goToWithdrawBtn) goToWithdrawBtn.onclick = () => window.location.href = 'withdraw.html';

    const supportBtn = document.getElementById('support-btn');
    if (supportBtn) supportBtn.onclick = () => tg.openTelegramLink('https://t.me/YourSupportUsername' );

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            tg.showConfirm("هل أنت متأكد أنك تريد تسجيل الخروج؟", async (confirmed) => {
                if (confirmed) {
                    try {
                        await signOut(auth);
                        showModal("تم تسجيل الخروج بنجاح.", "success");
                        setTimeout(() => window.location.reload(), 2000);
                    } catch (error) { showModal("فشل تسجيل الخروج.", "error"); }
                }
            });
        };
    }

    const withdrawBtn = document.getElementById('withdraw-btn');
    if (withdrawBtn) {
        withdrawBtn.onclick = async () => {
            const amountInput = document.getElementById('amount');
            const walletInput = document.getElementById('wallet');
            const amount = parseFloat(amountInput.value);
            const wallet = walletInput.value.trim();
            const minWithdrawal = 10;

            if (isNaN(amount) || amount <= 0) { showModal("الرجاء إدخال مبلغ صحيح.", "warning"); return; }
            if (wallet === "") { showModal("الرجاء إدخال عنوان المحفظة.", "warning"); return; }
            if (amount < minWithdrawal) { showModal(`الحد الأدنى للسحب هو ${minWithdrawal} USDT.`, "warning"); return; }
            if (!currentUserData || currentUserData.usdt < amount) { showModal("رصيدك الحالي غير كافٍ.", "error"); return; }

            withdrawBtn.disabled = true; withdrawBtn.innerText = "الرجاء الانتظار...";
            try {
                await addDoc(collection(db, "withdrawals"), {
                    userId: userId, username: currentUserData.username, amount: amount, wallet: wallet,
                    status: "pending", createdAt: serverTimestamp()
                });
                await updateDoc(userRef, { usdt: increment(-amount) });
                showModal("✅ تم إرسال طلب السحب بنجاح!", "success");
                amountInput.value = ""; walletInput.value = "";
            } catch (error) {
                showModal("حدث خطأ أثناء إرسال الطلب.", "error");
            } finally {
                withdrawBtn.disabled = false;
                withdrawBtn.innerText = "إرسال طلب السحب";
            }
        };
    }
    
    const checkinBtn = document.getElementById("checkin-btn");
    if (checkinBtn) {
        checkinBtn.onclick = async () => {
            if (!canCheckin) { showModal("لم تمر 24 ساعة.", "warning"); return; }
            if (!hasSharedToday) { showModal("شارك أولاً للحصول على المكافأة.", "warning"); return; }
            await updateDoc(userRef, { usdt: increment(0.1), lastCheckin: new Date(), streak: increment(1) });
            hasSharedToday = false;
            showModal("🎉 حصلت على 0.1 USDT!", "success");
        };
    }
    
    if (document.getElementById("leaderboard-list")) {
        fetchLeaderboard();
    }
}

let canCheckin = false;
let countdownInterval;
function startCountdown(lastCheckin) {
  const countdownEl = document.getElementById("countdown");
  const checkinBtnEl = document.getElementById("checkin-btn");
  if (!countdownEl || !checkinBtnEl) return;
  clearInterval(countdownInterval);
  const nextTime = lastCheckin ? new Date(lastCheckin.toDate().getTime() + 24 * 60 * 60 * 1000) : new Date();
  function updateTimer() {
    const now = new Date();
    const diff = nextTime - now;
    if (diff <= 0) {
      canCheckin = true;
      countdownEl.innerText = "تسجيل الحضور";
      checkinBtnEl.disabled = false;
      clearInterval(countdownInterval);
      return;
    }
    canCheckin = false;
    checkinBtnEl.disabled = true;
    const h = Math.floor(diff / 1000 / 60 / 60);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    countdownEl.innerText = `⏳ ${h}h ${m}m ${s}s`;
  };
  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

async function fetchLeaderboard() {
    const leaderboardList = document.getElementById("leaderboard-list");
    if (!leaderboardList) return;
    leaderboardList.innerHTML = `<p style="color: #f7931a; text-align: center; padding: 20px;">جاري جلب المتصدرين...</p>`;
    try {
        const q = query(collection(db, "users"), orderBy("usdt", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            leaderboardList.innerHTML = `<p style="color: #8b949e; text-align: center; padding: 20px;">لا يوجد متصدرون بعد.</p>`;
            return;
        }
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
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        leaderboardList.innerHTML = `<p style="color: #f44336; text-align: center; padding: 20px;">حدث خطأ: ${error.message}</p>`;
    }
}

function stringToColor(str) {
  if (!str) return '#8b949e';
  let hash = 0; str.split('').forEach(char => { hash = char.charCodeAt(0) + ((hash << 5) - hash); });
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += value.toString(16).padStart(2, '0');
  }
  return color;
}

// استدعاء الدالة الرئيسية لبدء التطبيق
main();
