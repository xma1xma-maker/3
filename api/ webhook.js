// /api/webhook.js

// استيراد الأدوات اللازمة من حزمة firebase-admin
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// --- إعدادات Firebase Admin ---
// هذه الطريقة آمنة لأنها تقرأ من متغيرات البيئة في Vercel
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // مهم جداً لمعالجة مفتاح الخاص
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

// تهيئة تطبيق Firebase (تأكد من عدم تهيئته مرتين)
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

// --- معالج الطلبات ---
export default async function handler(req, res) {
  try {
    // التأكد من أن الطلب هو POST
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const { message } = req.body;

    // إذا لم تكن هناك رسالة أو نص، تجاهل
    if (!message || !message.text) {
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id; // ID المستخدم الجديد
    const text = message.text;

    // التحقق مما إذا كانت الرسالة هي أمر /start مع ID
    if (text.startsWith('/start ')) {
      const referrerId = text.split(' ')[1]; // استخراج ID الشخص الذي دعا
      
      // تأكد من أن المستخدم لا يدعو نفسه
      if (referrerId && referrerId !== String(chatId)) {
        // تخزين أن هذا المستخدم تمت دعوته في مجموعة "invites"
        const invitedUserRef = db.collection('invites').doc(String(chatId));
        
        // تحقق أولاً إذا كان قد تمت دعوته من قبل
        const docSnap = await invitedUserRef.get();
        if (!docSnap.exists) {
            await invitedUserRef.set({
                referrerId: referrerId,
                invitedId: String(chatId),
                claimed: false, // لم تتم المطالبة بالمكافأة بعد
                timestamp: new Date(),
            });
        }
      }
    }
  } catch (error) {
    console.error('Error in webhook:', error);
  }
  
  // إرسال رد 200 OK لتيليجرام لتأكيد استلام التحديث بنجاح
  res.status(200).send('OK');
}
