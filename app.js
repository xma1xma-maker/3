// ================= TELEGRAM & GLOBAL STATE =================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#101218');
    tg.setBackgroundColor('#101218');
}

let db, auth, functions;
let userId = null, userRef = null, currentUserData = null;
let dailyCountdownInterval;

// ================= UI FUNCTIONS =================
function showLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    if (activeLink) activeLink.classList.add('active');
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
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
        userId = auth.currentUser.uid;
        userRef = db.collection("users").doc(userId);

        await initUser(tg?.initDataUnsafe?.user);
        bindAllEvents();

        userRef.onSnapshot((snap) => {
            if (snap.exists) {
                currentUserData = snap.data();
                updateUI(currentUserData);
                showLoader(false);
            }
        }, (error) => {
            console.error("Snapshot error:", error);
            showLoader(false);
        });

    } catch (error) {
        console.error("Critical Error:", error);
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
            league: 'برونزي',
            lastCheckin: null, streak: 0,
            clickerEnergy: 1000,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    }
}

function updateUI(data) {
    if (!data) return;
    const username = data.username || 'User';
    
    updateElement('username', username);
    updateElement('user-avatar', username.charAt(0).toUpperCase());
    updateElement('local-coin', Math.floor(data.localCoin));
    updateElement('league-name', data.league || 'برونزي');
    
    const maxEnergy = 1000;
    const currentEnergy = data.clickerEnergy ?? maxEnergy;
    updateElement('energy-level', `${currentEnergy}`);

    // Daily Reward Modal
    updateElement('streak-days', data.streak || 0);
    startDailyCountdown(data.lastCheckin);
}

// ================= EVENT BINDING =================
function bindAllEvents() {
    document.getElementById('clicker-button')?.addEventListener('click', handleTap);
    document.getElementById('daily-reward-icon')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.add('show'));
    document.querySelector('.modal-close-btn')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.remove('show'));
    document.getElementById('claim-reward-btn')?.addEventListener('click', handleClaimDailyReward);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });
}

// ================= EVENT HANDLERS =================
function handleTap(event) {
    if (!currentUserData || currentUserData.clickerEnergy <= 0) return;

    const clicker = event.currentTarget;
    clicker.style.transform = 'scale(0.95)';
    setTimeout(() => { clicker.style.transform = 'scale(1)'; }, 100);

    const feedback = document.createElement('div');
    feedback.className = 'click-feedback';
    feedback.innerText = '+1';
    document.body.appendChild(feedback);
    
    const x = event.clientX;
    const y = event.clientY;
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;

    feedback.addEventListener('animationend', () => feedback.remove());

    userRef.update({
        localCoin: firebase.firestore.FieldValue.increment(1),
        clickerEnergy: firebase.firestore.FieldValue.increment(-1)
    }).catch(console.error);
}

async function handleClaimDailyReward() {
    const btn = document.getElementById('claim-reward-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(500), // Example reward
            lastCheckin: firebase.firestore.FieldValue.serverTimestamp(),
            streak: firebase.firestore.FieldValue.increment(1)
        });
        document.getElementById('daily-reward-modal').classList.remove('show');
    } catch (error) {
        console.error("Daily reward error:", error);
        btn.disabled = false;
    }
}

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

// ================= START THE APP =================
main();
