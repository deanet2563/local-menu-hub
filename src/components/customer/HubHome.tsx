import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { isOrderingPreview } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { useCustomerCatalog } from "@/hooks/useCustomerCatalog";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";

// ============================================================
// MyTree — Food-first hub. Public catalog browsing must not trigger LINE login.
// Nearby shops are automatically refreshed on first load and after the app
// returns to the foreground if the previous GPS fix is older than 2 minutes
// (see useCustomerCatalog).
// ============================================================

export function HubHome() {
  const { items, loading, orderedShops, locationState, refreshNearbyShops, cats, shopName } = useCustomerCatalog();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const c = useCart();
  const staging = isOrderingPreview();

  const filtered = items.filter(
    (i) => (!cat || i.category === cat) && (!q || i.name.includes(q) || shopName(i.shop_id).includes(q))
  );

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="pb-24">
      <div className="p-4 space-y-3">
        <h1 className="text-xl font-bold">MyTree 🌳</h1>

        {staging && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <div>
              <p className="text-sm font-semibold text-blue-800">🧪 Staging Tools</p>
              <p className="text-xs text-blue-600">ใช้สำหรับทดสอบฝั่งร้าน โดยไม่กระทบ Rich Menu production</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/sweet/menu" className="rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white">
                จัดการรายการ
              </Link>
              <Link to="/sweet/shop" className="rounded-xl bg-white px-3 py-2 text-center text-sm font-medium text-blue-700 border border-blue-200">
                จัดการร้านค้า
              </Link>
            </div>
          </div>
        )}

        <input
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
          placeholder="ค้นหาอาหาร หรือร้าน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700">ร้านใกล้คุณ</p>
            {locationState === "ready" && <p className="text-[11px] text-[#3f6b4a]">เรียงตามตำแหน่งปัจจุบันแล้ว</p>}
            {locationState === "error" && <p className="text-[11px] text-gray-400">เปิดสิทธิ์ตำแหน่งเพื่อเรียงร้านที่ใกล้ที่สุด</p>}
          </div>
          <button
            type="button"
            onClick={() => void refreshNearbyShops()}
            disabled={locationState === "loading"}
            className="shrink-0 text-xs text-[#3f6b4a] disabled:opacity-50"
          >
            {locationState === "loading" ? "📍 กำลังค้นหา..." : "📍 อัปเดตตำแหน่ง"}
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {orderedShops.map((s) => (
            <Link key={s.shop_id} to="/shop/$shopId" params={{ shopId: s.shop_id }} className="shrink-0 w-20 text-center">
              <img src={s.logo_url ?? ""} alt={s.name} className="w-16 h-16 rounded-full object-cover mx-auto bg-gray-100" />
              <p className="text-xs mt-1 truncate">{s.name}</p>
            </Link>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCat(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${!cat ? "bg-[#3f6b4a] text-white" : "bg-gray-100"}`}
          >
            ทั้งหมด
          </button>
          {cats.map((cc) => (
            <button
              key={cc}
              onClick={() => setCat(cc)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${cat === cc ? "bg-[#3f6b4a] text-white" : "bg-gray-100"}`}
            >
              {cc}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        {filtered.map((i) => (
          <Link
            key={i.item_id}
            to="/shop/$shopId"
            params={{ shopId: i.shop_id }}
            className="rounded-xl overflow-hidden border border-gray-100"
          >
            <img src={i.image_url ?? ""} alt={i.name} className="w-full aspect-square object-cover bg-gray-100" />
            <div className="p-2">
              <p className="text-sm font-medium truncate">{i.name}</p>
              <p className="text-xs text-gray-400 truncate">{shopName(i.shop_id)}</p>
              <p className="text-sm font-bold text-[#a85f2c] mt-0.5">฿{i.price}</p>
            </div>
          </Link>
        ))}
      </div>

      <FloatingCartBar cart={c} />
    </div>
  );
}
