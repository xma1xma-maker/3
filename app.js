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

// ================= APP ENTRY POINT =================
async function main() {
    try {
        // 1. تهيئة Firebase
        const firebaseConfig = { apiKey: "AIzaSyD5YAKC8KO5jKHQdsdrA8Bm-ERD6yUdHBQ", authDomain: "tele-follow.firebaseapp.com", projectId: "tele-follow", storageBucket: "tele-follow.firebasestorage.app", messagingSenderId: "311701431089", appId: "1:311701431089:web:fcba431dcae893a87cc610" };
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        // 2. تسجيل الدخول
        await auth.signInAnonymously();
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert("فشل تسجيل الدخول المجهول!");
            return;
        }

        // 3. الحصول على معرف المستخدم
        // سنستخدم معرف Firebase (uid) مباشرة لضمان عدم وجود أي خطأ
        userId = currentUser.uid;
        userRef = db.collection("users").doc(userId);

        // 4. ربط زر المطالبة بالمكافأة
        const claimRewardBtn = document.getElementById("claim-reward-btn");
        if (claimRewardBtn) {
            claimRewardBtn.disabled = false; // تفعيل الزر دائماً لأغراض الاختبار
            claimRewardBtn.onclick = handleClaimReward;
        }

        // عرض رسالة نجاح الاتصال
        alert("تم الاتصال بنجاح! حاول المطالبة بالمكافأة الآن.");

    } catch (error) {
        alert(`حدث خطأ حرج: ${error.message}`);
    }
}

// ================= CLAIM FUNCTION =================
async function handleClaimReward() {
    const claimRewardBtn = document.getElementById("claim-reward-btn");
    claimRewardBtn.disabled = true;
    claimRewardBtn.innerText = "جاري المعالجة...";

    if (!userRef) {
        alert("خطأ: مرجع المستخدم غير موجود!");
        claimRewardBtn.disabled = false;
        claimRewardBtn.innerText = "المطالبة بالمكافأة";
        return;
    }

    try {
        // أبسط عملية تحديث ممكنة
        await userRef.set({
            usdt: firebase.firestore.FieldValue.increment(0.1),
            lastCheckin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // استخدام set مع merge لضمان الكتابة

        alert("🎉 نجحت العملية! تم إضافة 0.1 USDT.");
        claimRewardBtn.innerText = "نجح!";

    } catch (error) {
        // عرض رسالة الخطأ الحقيقية من Firebase
        alert(`فشل تحديث قاعدة البيانات: ${error.code} - ${error.message}`);
        claimRewardBtn.disabled = false;
        claimRewardBtn.innerText = "المطالبة بالمكافأة";
    }
}

// ================= START THE APP =================
main();
