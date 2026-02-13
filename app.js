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
let dailyCountdownInterval, hourlyCountdownInterval;

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
            lastHourlyClaim: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedTasks: [], redeemedCodes: []
        }, { merge: true });
    }
}

function updateUI(data) {
    if (!data) return;
    const username = data.username || 'User';
    updateElement('username', username);
    updateElement('user-avatar', username.charAt(0).toUpperCase());
    updateElement('local-coin', Math.floor(data.localCoin));
    updateElement('league-name', data.league || 'برونزي');
    updateElement('streak-days', data.streak || 0);
    updateElement('usdt-balance', Number(data.usdt).toFixed(2));
    updateElement('points-balance', Math.floor(data.localCoin));
    updateElement('referral-count', data.referrals || 0);
    startDailyCountdown(data.lastCheckin);
    startHourlyCountdown(data.lastHourlyClaim);
}

// ================= COUNTDOWN FUNCTIONS =================
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
    const el = document.getElementById("claim-hourly-btn");
    if (!el) return;
    clearInterval(hourlyCountdownInterval);
    if (!lastClaim) {
        el.innerText = "احصل على 100 نقطة";
        el.disabled = false;
        return;
    }
    const nextTime = new Date(lastClaim.toDate().getTime() + 60 * 60 * 1000);
    hourlyCountdownInterval = setInterval(() => {
        const diff = nextTime - new Date();
        if (diff <= 0) {
            el.innerText = "احصل على 100 نقطة";
            el.disabled = false;
            clearInterval(hourlyCountdownInterval);
            return;
        }
        el.disabled = true;
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerText = `جاهزة بعد: ${m} دقيقة و ${s} ثانية`;
    }, 1000);
}

// ================= EVENT BINDING =================
function bindAllEvents() {
    document.getElementById('daily-reward-icon')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.add('show'));
    document.querySelector('#daily-reward-modal .modal-close-btn')?.addEventListener('click', () => document.getElementById('daily-reward-modal').classList.remove('show'));
    document.getElementById('claim-reward-btn')?.addEventListener('click', handleClaimDailyReward);
    document.getElementById('claim-hourly-btn')?.addEventListener('click', handleClaimHourlyReward);
    document.getElementById('alert-close-btn')?.addEventListener('click', () => document.getElementById('alert-modal').classList.remove('show'));
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

// ================= EVENT HANDLERS =================
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

async function handleClaimHourlyReward() {
    const btn = document.getElementById('claim-hourly-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        await userRef.update({
            localCoin: firebase.firestore.FieldValue.increment(100),
            lastHourlyClaim: firebase.firestore.FieldValue.serverTimestamp()
        });
        showAlert("تهانينا! لقد حصلت على 100 نقطة.", "success");
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

// ================= TASKS FUNCTIONS =================
async function fetchAndDisplayTasks() {
    const urgentContainer = document.getElementById('urgent-tasks-container');
    const regularContainer = document.getElementById('tasks-list-container');
    const urgentSection = document.getElementById('urgent-tasks-section');
    const regularSection = document.getElementById('regular-tasks-section');

    urgentContainer.innerHTML = '<div class="loader-spinner" style="margin: 20px auto;"></div>';
    regularContainer.innerHTML = '<div class="loader-spinner" style="margin: 20px auto;"></div>';

    try {
        const tasksSnapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
        
        let urgentHtml = '';
        let regularHtml = '';

        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            const isCompleted = currentUserData.completedTasks?.includes(doc.id);
            const taskHtml = `
                <div class="task-item ${isCompleted ? 'completed' : ''} ${task.isUrgent ? 'urgent' : ''}">
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
            if (task.isUrgent) {
                urgentHtml += taskHtml;
            } else {
                regularHtml += taskHtml;
            }
        });

        urgentContainer.innerHTML = urgentHtml || '<p style="text-align:center; color:var(--text-muted);">لا توجد مهام عاجلة حالياً.</p>';
        regularContainer.innerHTML = regularHtml || '<p style="text-align:center; color:var(--text-muted);">لا توجد مهام يومية حالياً.</p>';
        
        urgentSection.style.display = urgentHtml ? 'block' : 'none';

        document.querySelectorAll('.task-action-btn').forEach(btn => {
            btn.addEventListener('click', handleTaskAction);
        });
    } catch (error) {
        console.error("Error fetching tasks:", error);
        urgentContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted);">حدث خطأ في جلب المهام.</p>';
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

    btn.disabled = true;
    btn.innerText = 'التحقق...';

    setTimeout(async () => {
        try {
            await userRef.update({
                localCoin: firebase.firestore.FieldValue.increment(taskReward),
                completedTasks: firebase.firestore.FieldValue.arrayUnion(taskId)
            });
            showAlert('تم إكمال المهمة بنجاح!', 'success');
            fetchAndDisplayTasks(); // Refresh tasks list
        } catch (error) {
            showAlert('فشل التحقق من المهمة.', 'error');
            btn.disabled = false;
            btn.innerText = 'اذهب';
        }
    }, 5000);
}

// ================= START THE APP =================
main();
