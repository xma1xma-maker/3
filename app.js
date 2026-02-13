// ================= TELEGRAM =================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// ================= GLOBAL STATE =================
let db, auth;
let userId = null;
let userRef = null;
let currentUserData = null;
let canCheckin = false;
let countdownInterval;

// ================= UI FUNCTIONS (Modal, Navigation, etc.) =================
const modalOverlay = document.getElementById('custom-modal');
const modalContent = document.querySelector('#custom-modal .modal-content');
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

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId)?.classList.add('active');
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
            updateNavIcons(pageId);
            if (pageId === 'leaderboard-page') fetchLeaderboard();
        });
    });
    const goToWithdrawBtn = document.getElementById('go-to-withdraw-btn');
    if (goToWithdrawBtn) {
        goToWithdrawBtn.onclick = () => {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('withdraw-page')?.classList.add('active');
        };
    }
}

function updateNavIcons(activePageId) {
    const navLinks = document.querySelectorAll('.nav-link');
    const iconMapping = { 'home-page': 'ri-home-5', 'tasks-page': 'ri-task', 'leaderboard-page': 'ri-trophy', 'profile-page': 'ri-user-3' };
    navLinks.forEach(link => {
        const pageId = link.getAttribute('data-page');
        const icon = link.querySelector('i');
        const baseIcon = iconMapping[pageId];
        if (baseIcon) icon.className = `${baseIcon}-${pageId === activePageId ? 'fill' : 'line'}`;
    });
}

// ================= APP ENTRY POINT =================
async function main() {
    try {
        const firebaseConfig = { apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ", authDomain: "tele-follow.firebaseapp.com", projectId: "tele-follow", storageBucket: "tele-follow.firebasestorage.app", messagingSenderId: "311701431089", appId: "1:311701431089:web:fcba431dcae893a87cc610" };
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        await auth.signInAnonymously();
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error("فشل المصادقة مع Firebase.");

        // استخدام معرف Firebase الموثوق
        userId = firebaseUser.uid;
        userRef = db.collection("users").doc(userId);

        // ربط جميع الأحداث مرة واحدة فقط
        setupNavigation();
        bindAllEvents();

        // تهيئة المستخدم أو إنشائه
        const tgUser = tg?.initDataUnsafe?.user;
        await initUser(tgUser);

        // إعداد المستمع للتحديثات الفورية
        userRef.onSnapshot((snap) => {
            if (snap.exists) {
                currentUserData = snap.data();
                updateUI(currentUserData);
            }
        }, (error) => {
            console.error("onSnapshot error:", error);
            showModal("خطأ في استقبال التحديثات.", "error");
        });

    } catch (error) {
        console.error("Critical Error in main():", error);
        showModal(`خطأ حرج: ${error.message}`, "error");
    }
}

// ================= CORE FUNCTIONS =================

async function initUser(tgUser) {
    const doc = await userRef.get();
    if (!doc.exists) {
        await userRef.set({
            telegramId: tgUser?.id ? String(tgUser.id) : 'N/A',
            username: tgUser?.username || tgUser?.first_name || 'New User',
            usdt: 0, localCoin: 0, level: 1, tasksCompleted: 0, referrals: 0,
            banned: false, lastCheckin: null, streak: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

function updateUI(data) {
    if (!data) return;
    updateElement("username", data.username);
    updateElement("user-initial", data.username.charAt(0).toUpperCase());
    updateElement("balance", Number(data.usdt).toFixed(2));
    updateElement("local-coin", Number(data.localCoin).toFixed(1));
    updateElement("tasks-completed", data.tasksCompleted);
    updateElement("referrals", data.referrals);
    updateElement("level", `LV.${data.level}`);
    updateElement("profile-username", data.username);
    updateElement("profile-user-initial", data.username.charAt(0).toUpperCase());
    updateElement("profile-user-id-display", data.telegramId);
    updateElement("profile-balance", Number(data.usdt).toFixed(2));
    updateElement("profile-local-coin", Number(data.localCoin).toFixed(1));
    updateElement("profile-referrals", data.referrals);
    const progress = (data.usdt % 100);
    const levelProgressEl = document.getElementById("level-progress");
    if (levelProgressEl) levelProgressEl.style.width = `${progress}%`;
    updateElement("streak-days", data.streak || 0);
    if (data.banned) { showModal("حسابك محظور", "error"); tg?.close(); }
    startCountdown(data.lastCheckin);
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// ================= EVENT BINDING (ONCE!) =================

function bindAllEvents() {
    // Reward Modal
    const dailyRewardIcon = document.getElementById('daily-reward-icon');
    const rewardModal = document.getElementById('daily-reward-modal');
    const rewardModalCloseBtn = document.getElementById('reward-modal-close-btn');
    if (dailyRewardIcon) dailyRewardIcon.onclick = () => rewardModal.classList.add('show');
    if (rewardModalCloseBtn) rewardModalCloseBtn.onclick = () => rewardModal.classList.remove('show');

    // Claim Button
    const claimRewardBtn = document.getElementById("claim-reward-btn");
    if (claimRewardBtn) claimRewardBtn.onclick = handleClaimReward;

    // Other Buttons
    document.querySelectorAll(".invite-btn").forEach(btn => btn.onclick = handleInvite);
    const supportBtn = document.getElementById('support-btn');
    if (supportBtn) supportBtn.onclick = () => tg.openTelegramLink('https://t.me/YourSupportUsername' );
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = handleLogout;
    const withdrawBtn = document.getElementById('withdraw-btn');
    if (withdrawBtn) withdrawBtn.onclick = handleWithdraw;
}

// ================= EVENT HANDLERS =================

async function handleClaimReward() {
    if (!canCheckin) {
        showModal("لم تمر 24 ساعة بعد.", "warning");
        return;
    }
    const btn = this;
    btn.disabled = true;
    try {
        await userRef.update({
            usdt: firebase.firestore.FieldValue.increment(0.1),
            lastCheckin: firebase.firestore.FieldValue.serverTimestamp(),
            streak: firebase.firestore.FieldValue.increment(1)
        });
        showModal("🎉 حصلت على 0.1 USDT!", "success");
        document.getElementById('daily-reward-modal').classList.remove('show');
    } catch (error) {
        showModal(`فشل تحديث المكافأة: ${error.message}`, "error");
        btn.disabled = false;
    }
}

function handleInvite() {
    const botUsername = "gdkmgkdbot";
    const inviteLink = `https://t.me/${botUsername}?start=${userId}`;
    showModal("شكراً لمشاركتك رابط الدعوة!", "success" );
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink )}&text=${encodeURIComponent("انضم إلى هذا البوت الرائع!")}`);
}

function handleLogout() {
    tg.showConfirm("هل أنت متأكد أنك تريد تسجيل الخروج؟", async (confirmed) => {
        if (confirmed) {
            try {
                await auth.signOut();
                showModal("تم تسجيل الخروج بنجاح.", "success");
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) { showModal("فشل تسجيل الخروج.", "error"); }
        }
    });
}

async function handleWithdraw() {
    // ... (This function remains the same)
}

// ================= OTHER FUNCTIONS (Countdown, Leaderboard) =================

function startCountdown(lastCheckin) {
    const countdownEl = document.getElementById("reward-countdown");
    const claimBtnEl = document.getElementById("claim-reward-btn");
    if (!countdownEl || !claimBtnEl) return;
    clearInterval(countdownInterval);
    if (!lastCheckin) {
        canCheckin = true;
        countdownEl.innerText = "المكافأة جاهزة!";
        claimBtnEl.disabled = false;
        return;
    }
    const nextTime = new Date(lastCheckin.toDate().getTime() + 24 * 60 * 60 * 1000);
    function updateTimer() {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            canCheckin = true;
            countdownEl.innerText = "المكافأة جاهزة!";
            claimBtnEl.disabled = false;
            clearInterval(countdownInterval);
            return;
        }
        canCheckin = false;
        claimBtnEl.disabled = true;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        countdownEl.innerText = `⏳ ${h}h ${m}m ${s}s`;
    }
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

async function fetchLeaderboard() {
    // ... (This function remains the same)
}

// ================= START THE APP =================
main();
