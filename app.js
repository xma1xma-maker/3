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
let dailyCountdownInterval, energyRegenInterval;

const MAX_ENERGY = 100;
const ENERGY_REGEN_RATE = 20000; // 20 seconds

// ================= UI FUNCTIONS =================
function showLoader(show) { document.getElementById('loader-overlay').style.display = show ? 'flex' : 'none'; }
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-page="${pageId}"]`)?.classList.add('active');
    if (pageId === 'earn-page') fetchAndDisplayTasks();
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

        // The onSnapshot listener is now the SINGLE SOURCE OF TRUTH for UI updates.
        userRef.onSnapshot((snap) => {
            if (snap.exists) {
                currentUserData = snap.data();
                updateUI(currentUserData);
                showLoader(false);
            }
        });
    } catch (error) {
        console.error("Critical Error:", error);
        showAlert(`خطأ حرج: ${error.message}`, "error");
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
            usdt: 0, localCoin: 0, league: 'برونزي', referrals: 0,
            lastCheckin: null, streak: 0, 
            clickerEnergy: MAX_ENERGY,
            lastEnergyUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedTasks: [], redeemedCodes: []
        });
    }
}

// This function ONLY updates the screen based on data from Firebase. No logic here.
function updateUI(data) {
    if (!data) return;
    const username = data.username || 'User';
    updateElement('username', username);
    updateElement('user-avatar', username.charAt(0).toUpperCase());
    updateElement('local-coin', Math.floor(data.localCoin));
    updateElement('league-name', data.league || 'برونزي');
    updateElement('energy-level', `${Math.floor(data.clickerEnergy)} / ${MAX_ENERGY}`);
    updateElement('streak-days', data.streak || 0);
    updateElement('usdt-balance', Number(data.usdt).toFixed(2));
    updateElement('points-balance', Math.floor(data.localCoin));
    updateElement('referral-count', data.referrals || 0);
    startDailyCountdown(data.lastCheckin);
    // The energy regeneration is now smarter and handled by a Cloud Function (or a more robust client-side timer).
}

// ================= EVENT BINDING =================
function bindAllEvents() {
    document.getElementById('clicker-button')?.addEventListener('click', handleTap);
    // ... (rest of the bindings are the same)
    document.getElementById('daily-reward-icon')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.add('show'));
    document.querySelector('#daily-reward-modal .modal-close-btn')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.remove('show'));
    document.getElementById('claim-reward-btn')?.addEventListener('click', handleClaimDailyReward);
    document.getElementById('alert-close-btn')?.addEventListener('click', () => document.getElementById('alert-modal').classList.remove('show'));
    document.getElementById('withdraw-btn')?.addEventListener('click', handleWithdraw);
    document.getElementById('redeem-gift-code-btn')?.addEventListener('click', handleRedeemGiftCode);
    document.querySelector('.invite-btn')?.addEventListener('click', handleInvite);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); showPage(link.dataset.page); });
    });
}

// ================= EVENT HANDLERS =================
// REWRITTEN: This function is now much simpler.
function handleTap(event) {
    // Check if we can tap based on the latest data.
    if (!currentUserData || currentUserData.clickerEnergy < 1) {
        // Optional: Add a "shake" animation to show no energy
        event.currentTarget.style.animation = 'shake 0.3s';
        setTimeout(() => { event.currentTarget.style.animation = ''; }, 300);
        return;
    }
    
    // Perform the click action in Firestore.
    // This is the ONLY place we write to the database for a tap.
    userRef.update({
        localCoin: firebase.firestore.FieldValue.increment(1),
        clickerEnergy: firebase.firestore.FieldValue.increment(-1)
    }).catch(console.error);

    // Visual feedback for the click (animation)
    event.currentTarget.style.transform = 'scale(0.95)';
    setTimeout(() => { event.currentTarget.style.transform = 'scale(1)'; }, 100);
    
    const feedback = document.createElement('div');
    feedback.className = 'click-feedback';
    feedback.innerText = '+1';
    document.body.appendChild(feedback);
    feedback.style.left = `${event.clientX}px`;
    feedback.style.top = `${event.clientY}px`;
    feedback.addEventListener('animationend', () => feedback.remove());
}

// --- The energy regeneration is now handled by a separate, robust timer ---
// This function will be called once when the app starts.
(function startSmartEnergyRegen() {
    setInterval(async () => {
        // Fetch the latest user data directly before updating.
        const doc = await userRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data.clickerEnergy < MAX_ENERGY) {
                // Calculate how much energy should have been generated since the last update.
                const lastUpdate = data.lastEnergyUpdate.toDate();
                const now = new Date();
                const diffSeconds = (now - lastUpdate) / 1000;
                const energyToRegen = Math.floor(diffSeconds / (ENERGY_REGEN_RATE / 1000));

                if (energyToRegen > 0) {
                    const newEnergy = Math.min(MAX_ENERGY, data.clickerEnergy + energyToRegen);
                    userRef.update({
                        clickerEnergy: newEnergy,
                        lastEnergyUpdate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }
    }, ENERGY_REGEN_RATE); // Check every 20 seconds
})();


// ... (Rest of the functions: handleClaimDailyReward, handleWithdraw, etc. are the same)
async function handleClaimDailyReward() {
    const btn = document.getElementById('claim-reward-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(500),
            lastCheckin: firebase.firestore.FieldValue.serverTimestamp(),
            streak: firebase.firestore.FieldValue.increment(1)
        });
        document.getElementById('daily-reward-modal').classList.remove('show');
        showAlert("تهانينا! لقد حصلت على 500 نقطة.", "success");
    } catch (error) {
        showAlert("حدث خطأ ما.", "error");
        btn.disabled = false;
    }
}

async function handleWithdraw() {
    const amount = parseFloat(document.getElementById('amount').value);
    const wallet = document.getElementById('wallet').value.trim();
    if (isNaN(amount) || amount < 10) return showAlert("الحد الأدنى للسحب هو 10 USDT.", "error");
    if (wallet.length < 10) return showAlert("الرجاء إدخال عنوان محفظة صحيح.", "error");
    if (!currentUserData || currentUserData.usdt < amount) return showAlert("رصيدك غير كافٍ.", "error");
    
    const btn = document.getElementById('withdraw-btn');
    btn.disabled = true; btn.innerText = "جاري الإرسال...";
    try {
        await db.collection("withdrawals").add({
            userId: userId, username: currentUserData.username, amount: amount, wallet: wallet,
            status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await userRef.update({ usdt: firebase.firestore.FieldValue.increment(-amount) });
        showAlert("تم إرسال طلب السحب بنجاح!", "success");
        document.getElementById('amount').value = "";
        document.getElementById('wallet').value = "";
    } catch (error) {
        showAlert("حدث خطأ أثناء إرسال الطلب.", "error");
    } finally {
        btn.disabled = false; btn.innerText = "إرسال طلب السحب";
    }
}

async function handleRedeemGiftCode() {
    const input = document.getElementById("gift-code-input");
    const code = input.value.trim().toUpperCase();
    if (code === "") return showAlert("الرجاء إدخال الكود.", "error");

    const btn = document.getElementById("redeem-gift-code-btn");
    btn.disabled = true; btn.innerText = "جاري التحقق...";
    try {
        const redeemFunction = functions.httpsCallable('redeemGiftCode' );
        const result = await redeemFunction({ code: code });
        if (result.data.success) {
            showAlert(`تهانينا! لقد ربحت ${result.data.reward} نقطة.`, "success");
            input.value = "";
        } else {
            showAlert(result.data.message, "error");
        }
    } catch (error) {
        showAlert(error.message || "الكود غير صحيح أو منتهي الصلاحية.", "error");
    } finally {
        btn.disabled = false; btn.innerText = "تفعيل الكود";
    }
}

function handleInvite() {
    const botUsername = "gdkmgkdbot"; // استبدل باسم بوتك
    const inviteLink = `https://t.me/${botUsername}?start=${userId}`;
    const shareText = `💰 انضم إلى هذا البوت الرائع واربح مكافآت! 💰\n\n${inviteLink}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink )}&text=${encodeURIComponent(shareText)}`);
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

async function fetchAndDisplayTasks() {
    const container = document.getElementById('tasks-list-container');
    container.innerHTML = '<div class="loader-spinner" style="margin: 40px auto;"></div>';
    try {
        const tasksSnapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
        if (tasksSnapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">لا توجد مهام حالياً.</p>';
            return;
        }
        let tasksHtml = '';
        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            const isCompleted = currentUserData.completedTasks?.includes(doc.id);
            tasksHtml += `
                <div class="task-item ${isCompleted ? 'completed' : ''}">
                    <div class="task-icon"><i class="${task.icon || 'ri-star-line'}"></i></div>
                    <div class="task-details">
                        <h4>${task.title}</h4>
                        <p>+${task.reward} نقطة</p>
                    </div>
                    <button class="btn-submit task-action-btn" data-task-id="${doc.id}" data-task-link="${task.link}" data-task-reward="${task.reward}" ${isCompleted ? 'disabled' : ''}>
                        ${isCompleted ? 'مكتملة' : 'اذهب'}
                    </button>
                </div>
            `;
        });
        container.innerHTML = tasksHtml;
        document.querySelectorAll('.task-action-btn').forEach(btn => {
            btn.addEventListener('click', handleTaskAction);
        });
    } catch (error) {
        console.error("Error fetching tasks:", error);
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">حدث خطأ في جلب المهام.</p>';
    }
}

async function handleTaskAction(event) {
    const btn = event.currentTarget;
    if (btn.disabled) return;
    const taskId = btn.dataset.taskId;
    const taskLink = btn.dataset.taskLink;
    const taskReward = parseInt(btn.dataset.taskReward);

    tg.openTelegramLink(taskLink);

    btn.disabled = true;
    btn.innerText = 'التحقق...';

    setTimeout(async () => {
        try {
            await userRef.update({
                localCoin: firebase.firestore.FieldValue.increment(taskReward),
                completedTasks: firebase.firestore.FieldValue.arrayUnion(taskId)
            });
            showAlert('تم إكمال المهمة بنجاح!', 'success');
            fetchAndDisplayTasks();
        } catch (error) {
            showAlert('فشل التحقق من المهمة.', 'error');
            btn.disabled = false;
            btn.innerText = 'اذهب';
        }
    }, 5000);
}

// ================= START THE APP =================
main();
