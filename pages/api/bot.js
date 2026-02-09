import TelegramBot from "node-telegram-bot-api";
import admin from "firebase-admin";

const bot = new TelegramBot(
  "8177053816:AAH9iiM-uQUSTsvkOO-1u8WBZ32YWIwJ5gM"
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_KEY)
    ),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("BTC WIN Bot");
  }

  bot.processUpdate(req.body);

  res.status(200).json({ ok: true });
}

// /start
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ref = match[1]?.trim();

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
      banned: false,
    });
  }

  bot.sendMessage(chatId, "🔥 مرحبًا بك في BTC WIN", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 Open BTC WIN",
            web_app: { url: "https://btc-win.vercel.app" },
          },
        ],
      ],
    },
  });
});
