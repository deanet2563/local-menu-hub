import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { cart, useCart, cartCount, cartTotal } from "@/lib/cart";

// ============================================================
// MyTree — Shop page: menu grouped by category + add to cart.
// ============================================================

type Shop = {
  shop_id: string; name: string; category: string | null; logo_url: string | null;
  is_open: boolean | null; delivery_note: string | null;
};
type Item = { item_id: string; shop_id: string; name: string; price: number; image_url: string | null; category: string | null };

export function ShopPage({ shopId }: { shopId: string }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const c = useCart();

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from("shops").select("shop_id,name,category,logo_url,is_open,delivery_note").eq("shop_id", shopId).maybeSingle(),
        supabase.from("menu_items").select("item_id,shop_id,name,price,image_url,category").eq("shop_id", shopId).eq("is_available", true),
      ]);
      setShop(s as Shop);
      setItems((m as Item[]) ?? []);
      setLoading(false);
    })();
  }, [shopId]);

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (!shop) return <p className="p-4 text-sm text-gray-400">ไม่พบร้าน</p>;

  const cats = Array.from(new Set(items.map((i) => i.category || "อื่นๆ")));
  const qtyOf = (id: string) => c.items.find((i) => i.itemId === id)?.qty ?? 0;
  const addItem = (i: Item) =>
    cart.add({ itemId: i.item_id, shopId: i.shop_id, name: i.name, price: i.price, imageUrl: i.image_url });

  return (
    <div className="pb-24">
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <Link to="/" className="text-gray-400 text-lg">‹</Link>
        <img src={shop.logo_url ?? ""} alt={shop.name} className="w-14 h-14 rounded-xl object-cover bg-gray-100" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{shop.name}</h1>
          <p className="text-xs text-gray-400 truncate">
            {shop.category}
            {shop.delivery_note ? ` · ${shop.delivery_note}` : ""}
          </p>
        </div>
      </div>

      {cats.map((cc) => (
        <div key={cc} className="px-4 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{cc}</p>
          <div className="space-y-3">
            {items
              .filter((i) => (i.category || "อื่นๆ") === cc)
              .map((i) => (
                <div key={i.item_id} className="flex gap-3 items-center">
                  <img src={i.image_url ?? ""} alt={i.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <p className="text-sm text-orange-600">฿{i.price}</p>
                  </div>
                  {qtyOf(i.item_id) > 0 ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => cart.setQty(i.item_id, qtyOf(i.item_id) - 1)} className="w-7 h-7 rounded-full bg-gray-100">−</button>
                      <span className="text-sm w-4 text-center">{qtyOf(i.item_id)}</span>
                      <button onClick={() => addItem(i)} className="w-7 h-7 rounded-full bg-orange-500 text-white">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addItem(i)} className="rounded-lg bg-orange-500 text-white text-sm px-3 py-1.5">
                      เพิ่ม
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      {cartCount(c) > 0 && (
        <Link
          to="/cart"
          className="fixed left-4 right-4 bottom-4 rounded-xl bg-orange-500 text-white px-4 py-3 flex justify-between text-sm font-medium"
        >
          <span>ดูตะกร้า ({cartCount(c)})</span>
          <span>฿{cartTotal(c)}</span>
        </Link>
      )}
    </div>
  );
}
