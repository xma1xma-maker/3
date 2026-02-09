import { useEffect, useState } from "react";
import { getTelegramUser } from "../lib/useTelegram";

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const tgUser = getTelegramUser();
    if (tgUser) {
      fetch(`/api/user?uid=${tgUser.id}`)
        .then(res => res.json())
        .then(setUser);
    }
  }, []);

  if (!user) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">BTC WIN</h1>

      <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
        <p className="text-gray-400">رصيدك</p>
        <h2 className="text-3xl font-bold">{user.usdt} USDT</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Box title="المستوى" value={`LV ${user.level}`} />
        <Box title="الإحالات" value={user.referrals} />
      </div>

      <BottomNav />
    </div>
  );
}

function Box({ title, value }) {
  return (
    <div className="bg-[#1a1a1a] p-3 rounded-xl text-center">
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
