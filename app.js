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
            
            // 🔥 التعديل: استدعاء fetchLeaderboard بشكل موثوق عند الانتقال للصفحة
            if (pageId === 'leaderboard-page') {
                fetchLeaderboard();
            }
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

        userId = firebaseUser.uid;
        userRef = db.collection("users").doc(userId);

        setupNavigation();
        bindAllEvents();

        const tgUser = tg?.initDataUnsafe?.user;
        await initUser(tgUser);

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
    const dailyRewardIcon = document.getElementById('daily-reward-icon');
    const rewardModal = document.getElementById('daily-reward-modal');
    const rewardModalCloseBtn = document.getElementById('reward-modal-close-btn');
    if (dailyRewardIcon) dailyRewardIcon.onclick = () => rewardModal.classList.add('show');
    if (rewardModalCloseBtn) rewardModalCloseBtn.onclick = () => rewardModal.classList.remove('show');

    const claimRewardBtn = document.getElementById("claim-reward-btn");
    if (claimRewardBtn) claimRewardBtn.onclick = handleClaimReward;

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
    const amountInput = document.getElementById('amount');
    const walletInput = document.getElementById('wallet');
    const amount = parseFloat(amountInput.value);
    const wallet = walletInput.value.trim();
    const minWithdrawal = 10;
    if (isNaN(amount) || amount <= 0) { showModal("الرجاء إدخال مبلغ صحيح.", "warning"); return; }
    if (wallet === "") { showModal("الرجاء إدخال عنوان المحفظة.", "warning"); return; }
    if (amount < minWithdrawal) { showModal(`الحد الأدنى للسحب هو ${minWithdrawal} USDT.`, "warning"); return; }
    if (!currentUserData || currentUserData.usdt < amount) { showModal("رصيدك الحالي غير كافٍ.", "error"); return; }
    const btn = this;
    btn.disabled = true; btn.innerText = "الرجاء الانتظار...";
    try {
        await db.collection("withdrawals").add({
            userId: userId, username: currentUserData.username, amount: amount, wallet: wallet,
            status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await userRef.update({ usdt: firebase.firestore.FieldValue.increment(-amount) });
        showModal("✅ تم إرسال طلب السحب بنجاح!", "success");
        amountInput.value = ""; walletInput.value = "";
    } catch (error) {
        showModal("حدث خطأ أثناء إرسال الطلب.", "error");
    } finally {
        btn.disabled = false; btn.innerText = "إرسال طلب السحب";
    }
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

// 🔥 --- دالة لوحة الصدارة المعدلة --- 🔥
async function fetchLeaderboard() {
    const leaderboardList = document.getElementById("leaderboard-list");
    if (!leaderboardList) return;

    // 1. التأكد من وجود اتصال بـ Firebase أولاً
    if (!db) {
        console.error("Firestore (db) is not initialized yet.");
        leaderboardList.innerHTML = `<p style="color: #f44336;">خطأ: لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    // 2. عرض رسالة "جاري الجلب" دائماً عند استدعاء الدالة
    leaderboardList.innerHTML = `<p style="color: #f7931a; text-align: center; padding: 20px;">جاري جلب المتصدرين...</p>`;

    try {
        // 3. جلب البيانات من Firebase
        const querySnapshot = await db.collection("users").orderBy("usdt", "desc").limit(20).get();
        
        if (querySnapshot.empty) {
            leaderboardList.innerHTML = `<p style="color: #8b949e; text-align: center; padding: 20px;">لا يوجد متصدرون بعد.</p>`;
            return;
        }

        // 4. مسح القائمة (للتأكد من عدم وجود عناصر قديمة) وبدء العرض
        leaderboardList.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            const item = document.createElement("div");
            item.className = "leaderboard-item";
            // دالة لإنشاء لون فريد لكل مستخدم
            const avatarColor = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                let color = '#';
                for (let i = 0; i < 3; i++) {
                    const value = (hash >> (i * 8)) & 0xFF;
                    color += ('00' + value.toString(16)).substr(-2);
                }
                return color;
            };
            item.innerHTML = `<div class="rank">${rank}</div><div class="avatar" style="background-color: ${avatarColor(userData.username)}"><span>${userData.username.charAt(0).toUpperCase()}</span></div><div class="user-info"><h4>${userData.username}</h4><small>LV. ${userData.level}</small></div><div class="user-score"><span>${Number(userData.usdt).toFixed(2)}</span><i class="ri-wallet-3-line"></i></div>`;
            leaderboardList.appendChild(item);
            rank++;
        });
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        leaderboardList.innerHTML = `<p style="color: #f44336; text-align: center; padding: 20px;">حدث خطأ أثناء جلب البيانات: ${error.message}</p>`;
    }
}

// ================= START THE APP =================
main();
