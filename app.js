// ================= ADSGRAM INTEGRATION =================
// <script src="https://sad.adsgram.ai/js/sad.min.js"></script>
// =======================================================

// ================= TELEGRAM & GLOBAL STATE =================
const tg = window.Telegram?.WebApp;
if (tg ) {
    tg.ready();
    tg.expand();
}

// We only need db. No auth or functions.
let db;
let userId = null; // This will be the user's Telegram ID
let userRef = null;
let currentUserData = null;
let dailyCountdownInterval, hourlyCountdownInterval;
let AdController = null;
let currentLanguage = 'ar';

const POINTS_PER_USDT_UNIT = 1000; 
const USDT_PER_UNIT = 0.1;

// ================= TRANSLATION FUNCTIONS =================
function setLanguage(lang) {
    currentLanguage = lang;
    const direction = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = direction;
    const headerColor = '#E0E7FF';
    tg?.setHeaderColor(headerColor);
    tg?.setBackgroundColor(headerColor);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang] && translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });
}

function i18n(key, replacements = {}) {
    let text = (translations[currentLanguage] && translations[currentLanguage][key]) || key;
    for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.replace(`{${placeholder}}`, value);
    }
    return text;
}

// ================= UI FUNCTIONS =================
function showLoader(show) { document.getElementById('loader-overlay').style.display = show ? 'flex' : 'none'; }
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-page="${pageId}"]`)?.classList.add('active');
    if (pageId === 'earn-page' && currentUserData) fetchAndDisplayTasks();
}
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}
function showAlert(message, type = 'success') {
    const modal = document.getElementById('alert-modal');
    const icon = document.getElementById('alert-icon');
    icon.innerHTML = type === 'success' ? '<i class="ri-checkbox-circle-line"></i>' : '<i class="ri-error-warning-line"></i>';
    icon.className = `modal-icon-wrapper ${type}`;
    document.getElementById('alert-message').innerText = message;
    modal.classList.add('show');
}

// ================= APP ENTRY POINT =================
async function main() {
    const tgUser = tg?.initDataUnsafe?.user;

    // **CRITICAL CHECK: Abort if Telegram user ID is not available**
    if (!tgUser || !tgUser.id) {
        showLoader(false);
        showAlert("Could not verify your Telegram account. Please restart the bot.", "error");
        console.error("Fatal: Telegram user data or ID is unavailable.");
        return; // Stop execution
    }

    const initialLang = tgUser.language_code === 'ar' ? 'ar' : 'en';
    setLanguage(initialLang);
    showLoader(true);

    try {
        const firebaseConfig = { apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ", authDomain: "tele-follow.firebaseapp.com", projectId: "tele-follow", storageBucket: "tele-follow.firebasestorage.app", messagingSenderId: "311701431089", appId: "1:311701431089:web:fcba431dcae893a87cc610" };
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();

        // **THE ULTIMATE FIX: Use Telegram ID as the direct and only identifier**
        userId = String(tgUser.id);
        userRef = db.collection("users").doc(userId);

        // Initialize AdsGram SDK
        try {
            if (window.Adsgram) {
                AdController = window.Adsgram.init({ blockId: "int-23433" });
            }
        } catch (e) { console.error("Error initializing AdsGram SDK:", e); }

        await initUser(tgUser, initialLang);
        bindAllEvents();

        // Listen for real-time updates on the user's document
        userRef.onSnapshot((snap) => {
            if (snap.exists) {
                currentUserData = snap.data();
                if (currentUserData.language && currentUserData.language !== currentLanguage) {
                    setLanguage(currentUserData.language);
                }
                updateUI(currentUserData);
            }
            showLoader(false); // Hide loader after the first data load
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            showAlert(i18n('error_occurred'), "error");
            showLoader(false);
        });

    } catch (error) {
        console.error("Critical Error during initialization:", error);
        showAlert(i18n('error_occurred'), "error");
        showLoader(false);
    }
}

// ================= CORE FUNCTIONS =================
async function initUser(tgUser, initialLang) {
    const doc = await userRef.get();
    if (!doc.exists) {
        console.log(`User document for ${userId} not found. Creating new one.`);
        const initialUsername = tgUser?.username || tgUser?.first_name || 'New User';
        let photoUrl = tgUser?.photo_url || '';
        await userRef.set({
            telegramId: String(tgUser.id), // Store it for reference
            username: initialUsername,
            photoUrl: photoUrl,
            language: initialLang,
            usdt: 0, localCoin: 0, referrals: 0,
            lastCheckin: null, streak: 0,
            lastHourlyClaim: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedTasks: [], redeemedCodes: []
        }, { merge: true });
    } else {
        console.log(`User document for ${userId} found. Not creating a new one.`);
    }
}

// (The rest of the file is the same, but I'm including it for completeness)
let eventsBound = false; 
function bindAllEvents() {
    if (eventsBound) return;
    eventsBound = true;
    document.getElementById('language-switcher')?.addEventListener('click', handleLanguageSwitch);
    document.getElementById('daily-reward-icon')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.add('show'));
    document.querySelector('#daily-reward-modal .modal-close-btn')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.remove('show'));
    document.getElementById('claim-reward-btn')?.addEventListener('click', handleClaimDailyReward);
    document.getElementById('claim-hourly-btn')?.addEventListener('click', handleClaimHourlyReward);
    document.getElementById('alert-close-btn')?.addEventListener('click', () => document.getElementById('alert-modal').classList.remove('show'));
    document.getElementById('convert-points-btn')?.addEventListener('click', handleConvertPoints);
    document.getElementById('withdraw-btn')?.addEventListener('click', handleWithdraw);
    document.getElementById('redeem-gift-code-btn')?.addEventListener('click', handleRedeemGiftCode);
    document.querySelector('.invite-btn')?.addEventListener('click', handleInvite);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); showPage(link.dataset.page); });
    });
    document.querySelectorAll('.action-card').forEach(card => {
        card.addEventListener('click', () => showPage(card.dataset.page));
    });
}

function updateUI(data) {
    if (!data) return;
    const username = data.username || 'User';
    const localCoin = Math.floor(data.localCoin);
    const usdt = Number(data.usdt).toFixed(4);
    updateElement('username', username);
    const avatarEl = document.getElementById('user-avatar');
    if (data.photoUrl) {
        avatarEl.src = data.photoUrl;
        avatarEl.onerror = () => {
            avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username  )}&background=6D28D9&color=fff&bold=true`;
        };
    } else {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username  )}&background=6D28D9&color=fff&bold=true`;
    }
    updateElement('local-coin', localCoin);
    updateElement('home-usdt-balance', usdt);
    updateElement('usdt-balance', usdt);
    updateElement('points-balance', localCoin);
    updateElement('referral-count', data.referrals || 0);
    const exchangeRateText = `${POINTS_PER_USDT_UNIT} ${i18n('points')} = ${USDT_PER_UNIT} USDT`;
    document.getElementById('exchange-rate-info-text').innerText = exchangeRateText;
    startDailyCountdown(data.lastCheckin);
    startHourlyCountdown(data.lastHourlyClaim);
}

function startDailyCountdown(lastCheckin) {
    const el = document.getElementById("reward-countdown");
    const btn = document.getElementById("claim-reward-btn");
    if (!el || !btn) return;
    clearInterval(dailyCountdownInterval);
    if (!lastCheckin) {
        el.innerText = i18n('reward_ready');
        btn.disabled = false;
        return;
    }
    const nextTime = new Date(lastCheckin.toDate().getTime() + 24 * 60 * 60 * 1000);
    dailyCountdownInterval = setInterval(() => {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            el.innerText = i18n('reward_ready');
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
    const el = document.getElementById("claim-hourly-btn");
    if (!el) return;
    clearInterval(hourlyCountdownInterval);
    if (!lastClaim) {
        el.innerText = i18n('claim_hourly_reward');
        el.disabled = false;
        return;
    }
    const nextTime = new Date(lastClaim.toDate().getTime() + 60 * 60 * 1000);
    hourlyCountdownInterval = setInterval(() => {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            el.innerText = i18n('claim_hourly_reward');
            el.disabled = false;
            clearInterval(hourlyCountdownInterval);
            return;
        }
        el.disabled = true;
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerText = `${i18n('ready_in')} ${m}m ${s}s`;
    }, 1000);
}

function showInterstitialAd() {
    if (!AdController) { return; }
    AdController.show().then(result => {}).catch(error => {});
}

async function handleLanguageSwitch() {
    const newLang = currentLanguage === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
    if (userRef) {
        try { await userRef.update({ language: newLang }); }
        catch (error) { console.error("Failed to save language preference:", error); }
    }
}

async function handleClaimDailyReward() {
    const btn = document.getElementById('claim-reward-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(500),
            lastCheckin: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('daily-reward-modal').classList.remove('show');
        showAlert(i18n('congrats_points', {points: 500}), "success");
        showInterstitialAd();
    } catch (error) {
        showAlert(i18n('error_occurred'), "error");
        btn.disabled = false;
    }
}

async function handleClaimHourlyReward() {
    const btn = document.getElementById('claim-hourly-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(100),
            lastHourlyClaim: firebase.firestore.FieldValue.serverTimestamp()
        });
        showAlert(i18n('congrats_points', {points: 100}), "success");
        showInterstitialAd();
    } catch (error) {
        showAlert(i18n('error_occurred'), "error");
        btn.disabled = false;
    }
}

async function handleRedeemGiftCode() {
    showAlert("Gift codes are temporarily unavailable.", "error");
}

async function handleConvertPoints() {
    const input = document.getElementById('points-to-convert');
    const pointsToConvert = parseInt(input.value);
    const btn = document.getElementById('convert-points-btn');
    if (isNaN(pointsToConvert) || pointsToConvert <= 0) return showAlert(i18n('enter_points_amount'), "error");
    if (!currentUserData || currentUserData.localCoin < pointsToConvert) return showAlert(i18n('points_insufficient'), "error");
    if (pointsToConvert < POINTS_PER_USDT_UNIT) return showAlert(`${i18n('min_conversion_limit')} ${POINTS_PER_USDT_UNIT} ${i18n('points')}.`, "error");
    btn.disabled = true; btn.innerText = i18n('loading');
    try {
        const usdtToAdd = (pointsToConvert / POINTS_PER_USDT_UNIT) * USDT_PER_UNIT;
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(-pointsToConvert),
            usdt: firebase.firestore.FieldValue.increment(usdtToAdd)
        });
        showAlert(`${pointsToConvert} ${i18n('points')} ${i18n('conversion_success')} ${usdtToAdd.toFixed(4)} USDT.`, "success");
        showInterstitialAd();
        input.value = "";
    } catch (error) {
        showAlert(i18n('error_occurred'), "error");
    } finally {
        btn.disabled = false; btn.innerText = i18n('convert_button');
    }
}

async function handleWithdraw() {
    const amount = parseFloat(document.getElementById('amount').value);
    const wallet = document.getElementById('wallet').value.trim();
    if (isNaN(amount) || amount < 10) return showAlert(`${i18n('min_10_usdt')} USDT.`, "error");
    if (wallet.length < 10) return showAlert(i18n('enter_wallet_address'), "error");
    if (!currentUserData || currentUserData.usdt < amount) return showAlert(i18n('usdt_balance'), "error");
    const btn = document.getElementById('withdraw-btn');
    btn.disabled = true; btn.innerText = i18n('loading');
    try {
        await db.collection("withdrawals").add({
            userId: userId,
            username: currentUserData.username, 
            amount: amount, 
            wallet: wallet,
            status: "pending", 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await userRef.update({ usdt: firebase.firestore.FieldValue.increment(-amount) });
        showAlert(i18n('withdrawal_success'), "success");
        document.getElementById('amount').value = "";
        document.getElementById('wallet').value = "";
    } catch (error) {
        showAlert(i18n('error_occurred'), "error");
    } finally {
        btn.disabled = false; btn.innerText = i18n('submit_withdrawal_request');
    }
}

function handleInvite() {
    const botLink = "https://t.me/Qqk_bot";
    const shareText = "اربح معنا الان";
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(botLink )}&text=${encodeURIComponent(shareText)}`);
}

async function fetchAndDisplayTasks() {
    const urgentContainer = document.getElementById('urgent-tasks-container');
    const regularContainer = document.getElementById('tasks-list-container');
    const urgentSection = document.getElementById('urgent-tasks-section');
    urgentContainer.innerHTML = '<div class="loader-spinner" style="margin: 20px auto;"></div>';
    regularContainer.innerHTML = '<div class="loader-spinner" style="margin: 20px auto;"></div>';
    try {
        const tasksSnapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
        let urgentHtml = '', regularHtml = '';
        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            const isCompleted = currentUserData.completedTasks?.includes(doc.id);
            const taskHtml = `<div class="task-item ${isCompleted ? 'completed' : ''} ${task.isUrgent ? 'urgent' : ''}"><div class="task-icon"><i class="${task.icon || 'ri-star-line'}"></i></div><div class="task-details"><h4>${task.title}</h4><p>+${task.reward} ${i18n('points')}</p></div><button class="btn-submit task-action-btn" data-task-id="${doc.id}" data-task-link="${task.link}" data-task-reward="${task.reward}" ${isCompleted ? 'disabled' : ''}>${isCompleted ? i18n('completed') : i18n('go')}</button></div>`;
            if (task.isUrgent) urgentHtml += taskHtml; else regularHtml += taskHtml;
        });
        urgentContainer.innerHTML = urgentHtml || '';
        regularContainer.innerHTML = regularHtml || `<p style="text-align:center; color:var(--text-muted);">${i18n('no_tasks_available')}</p>`;
        urgentSection.style.display = urgentHtml ? 'block' : 'none';
        document.querySelectorAll('.task-action-btn').forEach(btn => btn.addEventListener('click', handleTaskAction));
    } catch (error) {
        console.error("Error fetching tasks:", error);
        urgentContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted);">${i18n('error_occurred')}</p>`;
        regularContainer.innerHTML = '';
    }
}

async function handleTaskAction(event) {
    const btn = event.currentTarget;
    if (btn.disabled) return;
    const taskId = btn.dataset.taskId;
    const taskLink = btn.dataset.taskLink;
    const taskReward = parseInt(btn.dataset.taskReward);
    tg.openTelegramLink(taskLink);
    btn.disabled = true; btn.innerText = i18n('loading');
    setTimeout(async () => {
        try {
            await userRef.update({
                localCoin: firebase.firestore.FieldValue.increment(taskReward),
                completedTasks: firebase.firestore.FieldValue.arrayUnion(taskId)
            });
            showAlert(i18n('task_completion_success'), 'success');
            fetchAndDisplayTasks();
        } catch (error) {
            showAlert(i18n('task_verification_failed'), 'error');
            btn.disabled = false; btn.innerText = i18n('go');
        }
    }, 5000);
}

main();
