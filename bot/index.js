import TelegramBot from "node-telegram-bot-api";
import admin from "firebase-admin";

const BOT_TOKEN = process.env.BOT_TOKEN; // حط التوكن في Vercel Env
const bot = new TelegramBot(BOT_TOKEN);

// Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}
const db = admin.firestore();

// /start
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ref = match[1]?.replace(" ", "");
  const userRef = db.collection("users").doc(String(chatId));

  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      telegramId: chatId,
      username: msg.from.username || "",
      usdt: 0,
      referrals: 0,
      level: 1,
      joinedAt: new Date(),
      banned: false
    });

    if (ref) {
      const refUser = db.collection("users").doc(ref);
      await refUser.update({
        referrals: admin.firestore.FieldValue.increment(1),
        usdt: admin.firestore.FieldValue.increment(0.5)
      });
    }
  }

  bot.sendMessage(chatId, `🔥 مرحبًا بك في BTC WIN`, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 Open BTC WIN",
            web_app: { url: "https://3-chi-mocha.vercel.app" }
          }
        ]
      ]
    }
  });
});

export default bot;
