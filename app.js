// ================= TELEGRAM & GLOBAL STATE =================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.BackButton.onClick(() => window.history.back());
}

let db, auth, functions;
let userId = null, userRef = null, currentUserData = null;
let dailyCountdownInterval, hourlyCountdownInterval;
let canClaimDaily = false, canClaimHourly = false;

// ================= UI FUNCTIONS (Modal, Navigation) =================
const modalOverlay = document.getElementById('custom-modal');
const modalContent = document.querySelector('#custom-modal .modal-content');
const modalIcon = document.getElementById('modal-icon');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

function showModal(message, type = 'success') {
    if (!modalOverlay) return;
    const icons = { success: 'ri-checkbox-circle-fill', warning: 'ri-error-warning-fill', error: 'ri-close-circle-fill' };
    modalContent.className = `modal-content ${type}`;
    modalIcon.className = icons[type] || 'ri-information-fill';
    modalMessage.innerText = message;
    modalOverlay.classList.add('show');
}
if (modalCloseBtn) { modalCloseBtn.onclick = () => modalOverlay.classList.remove('show'); }

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    const isSubPage = ['withdraw-page', 'gift-code-page'].includes(pageId);
    if (isSubPage) {
        tg.BackButton.show();
    } else {
        tg.BackButton.hide();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
        if (activeLink) activeLink.classList.add('active');
        updateNavIcons(pageId);
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            history.pushState({page: pageId}, '', `#${pageId}`);
            showPage(pageId);
            if (pageId === 'leaderboard-page') fetchLeaderboard();
            if (pageId === 'tasks-page') fetchAndDisplayTasks();
        });
    });
    window.onpopstate = function(event) {
        const page = event.state ? event.state.page : 'home-page';
        showPage(page);
    };
}

function updateNavIcons(activePageId) {
    const navLinks = document.querySelectorAll('.nav-link');
    const iconMapping = { 'home-page': 'ri-home-5', 'tasks-page': 'ri-task', 'leaderboard-page': 'ri-trophy', 'profile-page': 'ri-user-3' };
    navLinks.forEach(link => {
        const pageId = link.getAttribute('data-page');
        const icon = link.querySelector('i');
        if (icon) {
            const baseIcon = iconMapping[pageId];
            if (baseIcon) icon.className = `${baseIcon}-${pageId === activePageId ? 'fill' : 'line'}`;
        }
    });
}

// ================= APP ENTRY POINT =================
async function main() {
    try {
        const firebaseConfig = { apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ", authDomain: "tele-follow.firebaseapp.com", projectId: "tele-follow", storageBucket: "tele-follow.firebasestorage.app", messagingSenderId: "311701431089", appId: "1:311701431089:web:fcba431dcae893a87cc610" };
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        functions = firebase.functions();

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
            lastHourlyClaim: null, clickerEnergy: 1000,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedTasks: [], redeemedCodes: []
        });
    }
}

function updateUI(data) {
    if (!data) return;
    updateElement("username", data.username);
    updateElement("user-initial", data.username.charAt(0).toUpperCase());
    updateElement("balance", Number(data.usdt).toFixed(2));
    updateElement("local-coin", Number(data.localCoin).toFixed(1));
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
    
    startDailyCountdown(data.lastCheckin);
    startHourlyCountdown(data.lastHourlyClaim);

    const maxEnergy = 1000;
    const currentEnergy = data.clickerEnergy !== undefined ? data.clickerEnergy : maxEnergy;
    updateElement("energy-level", currentEnergy);
    const energyBar = document.getElementById("energy-bar");
    if (energyBar) energyBar.style.width = `${(currentEnergy / maxEnergy) * 100}%`;
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// ================= EVENT BINDING =================
function bindAllEvents() {
    document.getElementById('daily-reward-icon')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.add('show'));
    document.getElementById('reward-modal-close-btn')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.remove('show'));
    document.getElementById("claim-reward-btn")?.addEventListener('click', handleClaimDailyReward);
    document.getElementById("claim-hourly-bonus-btn")?.addEventListener('click', handleClaimHourlyBonus);
    document.getElementById("treasure-box")?.addEventListener('click', handleTreasureClick);
    document.querySelectorAll(".invite-btn").forEach(btn => btn.addEventListener('click', handleInvite));
    document.getElementById('support-btn')?.addEventListener('click', () => tg.openTelegramLink('https://t.me/YourSupportUsername' ));
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('go-to-withdraw-btn')?.addEventListener('click', () => showPage('withdraw-page'));
    document.getElementById('withdraw-btn')?.addEventListener('click', handleWithdraw);
    document.getElementById("go-to-gift-code-btn")?.addEventListener('click', () => showPage('gift-code-page'));
    document.getElementById("redeem-gift-code-btn")?.addEventListener('click', handleRedeemGiftCode);
    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => window.history.back()));
}

// ================= EVENT HANDLERS =================
async function handleClaimDailyReward() {
    if (!canClaimDaily) return showModal("لم تمر 24 ساعة بعد.", "warning");
    const btn = document.getElementById('claim-reward-btn');
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

async function handleClaimHourlyBonus() {
    if (!canClaimHourly) return showModal("المكافأة ليست جاهزة بعد.", "warning");
    const btn = document.getElementById('claim-hourly-bonus-btn');
    btn.disabled = true;
    try {
        const rewardAmount = 10;
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(rewardAmount),
            lastHourlyClaim: firebase.firestore.FieldValue.serverTimestamp()
        });
        showModal(`🎉 حصلت على ${rewardAmount} نقطة!`, "success");
    } catch (error) {
        showModal(`فشل الحصول على المكافأة: ${error.message}`, "error");
        btn.disabled = false;
    }
}

async function handleTreasureClick() {
    if (!currentUserData || currentUserData.clickerEnergy <= 0) return;
    const box = document.getElementById("treasure-box");
    box.classList.add("shake");
    setTimeout(() => box.classList.remove("shake"), 500);
    try {
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(1),
            clickerEnergy: firebase.firestore.FieldValue.increment(-1)
        });
    } catch (error) { console.error("Clicker error:", error); }
}

function handleInvite() {
    const botUsername = "gdkmgkdbot";
    const inviteLink = `https://t.me/${botUsername}?start=${userId}`;
    const shareText = `💰 انضم إلى هذا البوت الرائع واربح مكافآت يومية! 💰\n\n${inviteLink}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink )}&text=${encodeURIComponent(shareText)}`);
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
    const amount = parseFloat(document.getElementById('amount').value);
    const wallet = document.getElementById('wallet').value.trim();
    if (isNaN(amount) || amount < 10) return showModal("الحد الأدنى للسحب هو 10 USDT.", "warning");
    if (wallet.length < 10) return showModal("الرجاء إدخال عنوان محفظة صحيح.", "warning");
    if (!currentUserData || currentUserData.usdt < amount) return showModal("رصيدك الحالي غير كافٍ.", "error");
    
    const btn = document.getElementById('withdraw-btn');
    btn.disabled = true; btn.innerText = "الرجاء الانتظار...";
    try {
        await db.collection("withdrawals").add({
            userId: userId, username: currentUserData.username, amount: amount, wallet: wallet,
            status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await userRef.update({ usdt: firebase.firestore.FieldValue.increment(-amount) });
        showModal("✅ تم إرسال طلب السحب بنجاح!", "success");
        document.getElementById('amount').value = "";
        document.getElementById('wallet').value = "";
        showPage('home-page');
    } catch (error) {
        showModal("حدث خطأ أثناء إرسال الطلب.", "error");
    } finally {
        btn.disabled = false; btn.innerText = "إرسال طلب السحب";
    }
}

async function handleRedeemGiftCode() {
    const input = document.getElementById("gift-code-input");
    const code = input.value.trim().toUpperCase();
    if (code === "") return showModal("الرجاء إدخال الكود.", "warning");

    const btn = document.getElementById("redeem-gift-code-btn");
    btn.disabled = true; btn.innerText = "جاري التحقق...";
    try {
        const redeemFunction = functions.httpsCallable('redeemGiftCode' );
        const result = await redeemFunction({ code: code });
        if (result.data.success) {
            showModal(`🎉 تهانينا! لقد ربحت ${result.data.reward} نقطة.`, "success");
            input.value = "";
            showPage('profile-page');
        } else {
            showModal(result.data.message, "error");
        }
    } catch (error) {
        showModal(error.message || "الكود غير صحيح أو منتهي الصلاحية.", "error");
    } finally {
        btn.disabled = false; btn.innerText = "تأكيد";
    }
}

// ================= TASKS & LEADERBOARD =================
async function fetchAndDisplayTasks() { /* ... الكود موجود مسبقاً ... */ }
async function handleTaskAction(event) { /* ... الكود موجود مسبقاً ... */ }
async function fetchLeaderboard() { /* ... الكود موجود مسبقاً ... */ }

// ================= COUNTDOWN TIMERS =================
function startDailyCountdown(lastCheckin) {
    const el = document.getElementById("reward-countdown");
    const btn = document.getElementById("claim-reward-btn");
    if (!el || !btn) return;
    clearInterval(dailyCountdownInterval);
    if (!lastCheckin) {
        canClaimDaily = true;
        el.innerText = "المكافأة جاهزة!";
        btn.disabled = false;
        return;
    }
    const nextTime = new Date(lastCheckin.toDate().getTime() + 24 * 60 * 60 * 1000);
    dailyCountdownInterval = setInterval(() => {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            canClaimDaily = true;
            el.innerText = "المكافأة جاهزة!";
            btn.disabled = false;
            clearInterval(dailyCountdownInterval);
            return;
        }
        canClaimDaily = false;
        btn.disabled = true;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerText = `⏳ ${h}h ${m}m ${s}s`;
    }, 1000);
}

function startHourlyCountdown(lastClaim) {
    const el = document.getElementById("hourly-bonus-timer");
    const btn = document.getElementById("claim-hourly-bonus-btn");
    if (!el || !btn) return;
    clearInterval(hourlyCountdownInterval);
    if (!lastClaim) {
        canClaimHourly = true;
        el.innerText = "جاهزة للمطالبة!";
        btn.disabled = false;
        return;
    }
    const nextTime = new Date(lastClaim.toDate().getTime() + 60 * 60 * 1000);
    hourlyCountdownInterval = setInterval(() => {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            canClaimHourly = true;
            el.innerText = "جاهزة للمطالبة!";
            btn.disabled = false;
            clearInterval(hourlyCountdownInterval);
            return;
        }
        canClaimHourly = false;
        btn.disabled = true;
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerText = `جاهزة بعد: ${m} دقيقة و ${s} ثانية`;
    }, 1000);
}

// ================= START THE APP م=================
main();
