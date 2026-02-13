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

// ================= UI FUNCTIONS =================
function showLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.style.opacity = show ? '1' : '0';
        loader.style.visibility = show ? 'visible' : 'hidden';
    }
}

function showModal(message, type = 'success') {
    const modalOverlay = document.getElementById('custom-modal');
    if (!modalOverlay) return;
    const icons = { success: 'ri-checkbox-circle-fill', error: 'ri-close-circle-fill' };
    const iconEl = modalOverlay.querySelector('#modal-icon');
    if (iconEl) {
        iconEl.className = icons[type] || 'ri-information-fill';
        iconEl.parentElement.className = `modal-content ${type}`;
    }
    modalOverlay.querySelector('#modal-message').innerText = message;
    modalOverlay.classList.add('show');
}

function showPage(pageId, isBack = false) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    const isSubPage = targetPage?.classList.contains('sub-page');
    if (isSubPage) {
        tg.BackButton.show();
        if (!isBack) history.pushState({ page: pageId }, '', `#${pageId}`);
    } else {
        tg.BackButton.hide();
        if (!isBack) history.pushState({ page: 'home-page' }, '', `#home`);
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
            showPage(pageId);
            if (pageId === 'leaderboard-page') fetchLeaderboard();
            if (pageId === 'tasks-page') fetchAndDisplayTasks();
        });
    });
    window.onpopstate = (event) => {
        const page = event.state ? event.state.page : 'home-page';
        showPage(page, true);
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
    showLoader(true);
    try {
        const firebaseConfig = { apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ", authDomain: "tele-follow.firebaseapp.com", projectId: "tele-follow", storageBucket: "tele-follow.firebasestorage.app", messagingSenderId: "311701431089", appId: "1:311701431089:web:fcba431dcae893a87cc610" };
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        functions = firebase.functions();

        await auth.signInAnonymously();
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error("Authentication Failed");

        userId = firebaseUser.uid;
        userRef = db.collection("users").doc(userId);

        setupNavigation();
        bindAllEvents();

        await initUser(tg?.initDataUnsafe?.user);

        userRef.onSnapshot((snap) => {
            if (snap.exists) {
                currentUserData = snap.data();
                updateUI(currentUserData);
                showLoader(false);
            }
        }, (error) => {
            console.error("Snapshot error:", error);
            showModal("خطأ في تحديث البيانات.", "error");
            showLoader(false);
        });

    } catch (error) {
        console.error("Critical Error:", error);
        showModal(`خطأ حرج: ${error.message}`, "error");
        showLoader(false);
    }
}

// ================= CORE FUNCTIONS =================
async function initUser(tgUser) {
    const doc = await userRef.get();
    if (!doc.exists) {
        await userRef.set({
            telegramId: tgUser?.id ? String(tgUser.id) : 'N/A',
            username: tgUser?.username || tgUser?.first_name || 'New User',
            usdt: 0, localCoin: 0,
            lastCheckin: null, streak: 0,
            lastHourlyClaim: null, clickerEnergy: 1000,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedTasks: [], redeemedCodes: []
        });
    }
}

function updateUI(data) {
    if (!data) return;
    const username = data.username || 'User';
    const initial = username.charAt(0).toUpperCase();
    
    updateElement('username', username);
    updateElement('user-avatar', initial);
    updateElement('balance', Number(data.usdt).toFixed(2));
    updateElement('local-coin', Math.floor(data.localCoin));
    
    const level = Math.floor(data.usdt / 100) + 1;
    const progress = (data.usdt % 100);
    updateElement('level-name', `المستوى ${level}`);
    updateElement('level-progress-text', `${Math.floor(progress)}/100`);
    const levelProgressEl = document.getElementById("level-progress");
    if (levelProgressEl) levelProgressEl.style.width = `${progress}%`;

    const maxEnergy = 1000;
    const currentEnergy = data.clickerEnergy ?? maxEnergy;
    updateElement('energy-level', currentEnergy);

    updateElement('profile-avatar', initial);
    updateElement('profile-username', username);
    updateElement('profile-user-id-display', data.telegramId);

    startDailyCountdown(data.lastCheckin);
    startHourlyCountdown(data.lastHourlyClaim);
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
    document.getElementById('go-to-withdraw-btn')?.addEventListener('click', () => showPage('withdraw-page'));
    document.getElementById('withdraw-btn')?.addEventListener('click', handleWithdraw);
    document.getElementById("go-to-gift-code-btn")?.addEventListener('click', () => showPage('gift-code-page'));
    document.getElementById("redeem-gift-code-btn")?.addEventListener('click', handleRedeemGiftCode);
    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => window.history.back()));
    document.getElementById('modal-close-btn')?.addEventListener('click', () => document.getElementById('custom-modal').classList.remove('show'));
}

// ================= EVENT HANDLERS =================
async function handleClaimDailyReward() { /* ... (Same as before) ... */ }
async function handleClaimHourlyBonus() { /* ... (Same as before) ... */ }
async function handleTreasureClick() { /* ... (Same as before) ... */ }
function handleInvite() { /* ... (Same as before) ... */ }
async function handleWithdraw() { /* ... (Same as before) ... */ }
async function handleRedeemGiftCode() { /* ... (Same as before) ... */ }

// ================= TASKS & LEADERBOARD (Placeholders) =================
async function fetchAndDisplayTasks() {
    const container = document.getElementById('tasks-list-container');
    if(container) container.innerHTML = `<p style="text-align:center; color:var(--text-muted);">لا توجد مهام حالياً.</p>`;
}
async function fetchLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    if(container) container.innerHTML = `<p style="text-align:center; color:var(--text-muted);">لا توجد بيانات لعرضها.</p>`;
}

// ================= COUNTDOWN TIMERS =================
function startDailyCountdown(lastCheckin) {
    const el = document.getElementById("reward-countdown");
    const btn = document.getElementById("claim-reward-btn");
    if (!el || !btn) return;
    clearInterval(dailyCountdownInterval);
    if (!lastCheckin) {
        el.innerText = "المكافأة جاهزة!";
        btn.disabled = false;
        return;
    }
    const nextTime = new Date(lastCheckin.toDate().getTime() + 24 * 60 * 60 * 1000);
    dailyCountdownInterval = setInterval(() => {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            el.innerText = "المكافأة جاهزة!";
            btn.disabled = false;
            clearInterval(dailyCountdownInterval);
            return;
        }
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
        el.innerText = "جاهزة للمطالبة!";
        btn.disabled = false;
        return;
    }
    const nextTime = new Date(lastClaim.toDate().getTime() + 60 * 60 * 1000);
    hourlyCountdownInterval = setInterval(() => {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            el.innerText = "جاهزة للمطالبة!";
            btn.disabled = false;
            clearInterval(hourlyCountdownInterval);
            return;
        }
        btn.disabled = true;
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerText = `جاهزة بعد: ${m} دقيقة و ${s} ثانية`;
    }, 1000);
}

// ================= START THE APP =================
main();
