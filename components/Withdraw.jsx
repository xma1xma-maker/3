import { useState } from "react";

export default function Withdraw({ user }) {
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");

  const submit = async () => {
    const res = await fetch("/api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.telegramId,
        amount: Number(amount),
        wallet,
      }),
    });

    const data = await res.json();
    alert(data.success ? "تم إرسال الطلب" : data.error);
  };

  return (
    <div className="p-4 text-white">
      <h2 className="text-xl mb-3">سحب USDT</h2>

      <input
        className="w-full p-2 mb-2 bg-gray-800 rounded"
        placeholder="المبلغ"
        onChange={(e) => setAmount(e.target.value)}
      />

      <input
        className="w-full p-2 mb-3 bg-gray-800 rounded"
        placeholder="عنوان محفظة TRC20"
        onChange={(e) => setWallet(e.target.value)}
      />

      <button
        onClick={submit}
        className="w-full bg-orange-500 p-2 rounded"
      >
        طلب سحب
      </button>
    </div>
  );
}
