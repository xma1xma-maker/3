import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY)),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { uid, amount, wallet } = req.body;

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = userSnap.data();

  const settingsSnap = await db.collection("settings").doc("main").get();
  const { minWithdraw, withdrawEnabled } = settingsSnap.data();

  if (!withdrawEnabled) {
    return res.status(403).json({ error: "Withdraw disabled" });
  }

  if (amount < minWithdraw || amount > user.usdt) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  await db.collection("withdraw_requests").add({
    uid,
    username: user.username,
    amount,
    wallet,
    status: "pending",
    createdAt: new Date(),
  });

  res.json({ success: true });
}
