import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";
import { useCart, cartCount, cartTotal } from "@/lib/cart";

// ============================================================
// MyTree — Food-first hub. Shows food photos across ALL shops before
// shop selection (core UX principle). Tap a dish -> that shop.
// ============================================================

type Shop = { shop_id: string; name: string; category: string | null; logo_url: string | null };
type Item = { item_id: string; shop_id: string; name: string; price: number; image_url: string | null; category: string | null };

export function HubHome() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [nearOrder, setNearOrder] = useState<string[] | null>(null);
  const c = useCart();

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from("shops").select("shop_id,name,category,logo_url").eq("is_open", true).eq("is_approved", true).eq("is_banned", false),
        supabase
          .from("menu_items")
          .select("item_id,shop_id,name,price,image_url,category, shops!inner(is_open,is_approved,is_banned)")
          .eq("is_available", true)
          .eq("shops.is_open", true)
          .eq("shops.is_approved", true)
          .eq("shops.is_banned", false),
      ]);
      setShops((s as Shop[]) ?? []);
      setItems((m as Item[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const shopName = (id: string) => shops.find((x) => x.shop_id === id)?.name ?? "";
  const cats = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items]
  );
  const filtered = items.filter(
    (i) => (!cat || i.category === cat) && (!q || i.name.includes(q) || shopName(i.shop_id).includes(q))
  );
  const orderedShops = nearOrder
    ? [...shops].sort((a, b) => nearOrder.indexOf(a.shop_id) - nearOrder.indexOf(b.shop_id))
    : shops;

  async function useMyLocation() {
    try {
      const loc = await getCurrentLocation();
      const { data } = await supabase.rpc("fn_shops_near_location", { p_lat: loc.lat, p_lng: loc.lng });
      if (data) setNearOrder((data as { shop_id: string }[]).map((r) => r.shop_id));
    } catch {
      /* ignore */
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="pb-24">
      <div className="p-4 space-y-3">
        <h1 className="text-xl font-bold">MyTree 🌳</h1>
        <input
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
          placeholder="ค้นหาอาหาร หรือร้าน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">ร้านใกล้คุณ</p>
          <button onClick={useMyLocation} className="text-xs text-orange-500">📍 ใช้ตำแหน่ง</button>
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
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${!cat ? "bg-orange-500 text-white" : "bg-gray-100"}`}
          >
            ทั้งหมด
          </button>
          {cats.map((cc) => (
            <button
              key={cc}
              onClick={() => setCat(cc)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${cat === cc ? "bg-orange-500 text-white" : "bg-gray-100"}`}
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
              <p className="text-sm text-orange-600 mt-0.5">฿{i.price}</p>
            </div>
          </Link>
        ))}
      </div>

      {cartCount(c) > 0 && (
        <Link
          to="/cart"
          className="fixed left-4 right-4 bottom-4 rounded-xl bg-orange-500 text-white px-4 py-3 flex justify-between text-sm font-medium"
        >
          <span>ตะกร้า ({cartCount(c)})</span>
          <span>฿{cartTotal(c)}</span>
        </Link>
      )}
    </div>
  );
}
