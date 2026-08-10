import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { cart, useCart, cartCount, cartTotal } from "@/lib/cart";
import { ProductConfigurator, type ConfigurableProduct } from "@/components/customer/ProductConfigurator";
import { BundleConfigurator } from "@/components/customer/BundleConfigurator";
import { loadShopBundles, type OrderingBundle } from "@/lib/ordering-config";

// ============================================================
// MyTree — Shop page: menu + shop-defined configurable sets/bundles.
// ============================================================

type Shop = {
  shop_id: string; name: string; category: string | null; logo_url: string | null;
  is_open: boolean | null; delivery_note: string | null;
  is_approved: boolean; is_banned: boolean;
};
type Item = { item_id: string; shop_id: string; name: string; price: number; image_url: string | null; category: string | null };

export function ShopPage({ shopId }: { shopId: string }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [bundles, setBundles] = useState<OrderingBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<Item | null>(null);
  const [configuringBundle, setConfiguringBundle] = useState<OrderingBundle | null>(null);
  const c = useCart();

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from("shops").select("shop_id,name,category,logo_url,is_open,delivery_note,is_approved,is_banned").eq("shop_id", shopId).maybeSingle(),
        supabase.from("menu_items").select("item_id,shop_id,name,price,image_url,category").eq("shop_id", shopId).eq("is_available", true),
      ]);
      setShop(s as Shop);
      setItems((m as Item[]) ?? []);
      try {
        setBundles(await loadShopBundles(shopId));
      } catch {
        // Migration may not be applied yet. Preserve the existing menu flow.
        setBundles([]);
      }
      setLoading(false);
    })();
  }, [shopId]);

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (!shop) return <p className="p-4 text-sm text-gray-400">ไม่พบร้าน</p>;
  if (!shop.is_approved || shop.is_banned) return <p className="p-4 text-sm text-gray-400">ร้านนี้ยังไม่พร้อมให้บริการ</p>;

  const cats = Array.from(new Set(items.map((i) => i.category || "อื่นๆ")));
  const qtyOf = (id: string) => c.items.filter((i) => i.itemId === id).reduce((n, i) => n + i.qty, 0);

  function configuredAdd(input: {
    product: ConfigurableProduct;
    qty: number;
    options: Parameters<typeof cart.add>[0]["options"];
    note: string | null;
  }) {
    const payload = {
      itemId: input.product.itemId,
      shopId: input.product.shopId,
      name: input.product.name,
      price: input.product.price,
      imageUrl: input.product.imageUrl,
      options: input.options,
      note: input.note,
    };

    let result: ReturnType<typeof cart.add> = "ok";
    for (let n = 0; n < input.qty; n += 1) {
      result = cart.add(payload);
      if (result === "different_shop") break;
    }

    if (result === "different_shop") {
      const ok = window.confirm("ตะกร้ามีของจากร้านอื่นอยู่ — สั่งได้ทีละร้านเท่านั้น\nล้างตะกร้าแล้วเริ่มใหม่กับร้านนี้ไหม?");
      if (!ok) return;
      for (let n = 0; n < input.qty; n += 1) cart.add(payload, { force: n === 0 });
    }
    setConfiguring(null);
  }

  function configuredBundleAdd(input: Parameters<React.ComponentProps<typeof BundleConfigurator>["onConfirm"]>[0]) {
    const payload = {
      kind: "bundle" as const,
      itemId: input.bundle.bundle_id,
      shopId: input.bundle.shop_id,
      name: input.bundle.name,
      price: input.bundle.price,
      imageUrl: input.bundle.image_url,
      options: input.options,
      note: input.note,
      bundleSelections: input.selections,
    };

    let result: ReturnType<typeof cart.add> = "ok";
    for (let n = 0; n < input.qty; n += 1) {
      result = cart.add(payload);
      if (result === "different_shop") break;
    }
    if (result === "different_shop") {
      const ok = window.confirm("ตะกร้ามีของจากร้านอื่นอยู่ — สั่งได้ทีละร้านเท่านั้น\nล้างตะกร้าแล้วเริ่มใหม่กับร้านนี้ไหม?");
      if (!ok) return;
      for (let n = 0; n < input.qty; n += 1) cart.add(payload, { force: n === 0 });
    }
    setConfiguringBundle(null);
  }

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

      {bundles.length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex items-end justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800">จัดเป็นชุด</p>
            <p className="text-[11px] text-gray-400">เลือกสินค้าในชุดได้เอง</p>
          </div>
          <div className="space-y-3">
            {bundles.map((bundle) => (
              <div key={bundle.bundle_id} className="flex gap-3 items-center rounded-xl border border-orange-100 bg-orange-50/40 p-2.5">
                <img src={bundle.image_url ?? ""} alt={bundle.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bundle.name}</p>
                  {bundle.description && <p className="text-xs text-gray-400 line-clamp-2">{bundle.description}</p>}
                  <p className="text-sm text-orange-600 mt-0.5">฿{bundle.price}</p>
                </div>
                <button onClick={() => setConfiguringBundle(bundle)} className="rounded-lg bg-orange-500 text-white text-sm px-3 py-1.5">จัดชุด</button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    {qtyOf(i.item_id) > 0 && <p className="text-[11px] text-gray-400">ในตะกร้า {qtyOf(i.item_id)} ชิ้น</p>}
                  </div>
                  <button onClick={() => setConfiguring(i)} className="rounded-lg bg-orange-500 text-white text-sm px-3 py-1.5">
                    {qtyOf(i.item_id) > 0 ? "เพิ่มอีก" : "เพิ่ม"}
                  </button>
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

      {configuring && (
        <ProductConfigurator
          product={{
            itemId: configuring.item_id,
            shopId: configuring.shop_id,
            name: configuring.name,
            price: configuring.price,
            imageUrl: configuring.image_url,
          }}
          onClose={() => setConfiguring(null)}
          onConfirm={configuredAdd}
        />
      )}

      {configuringBundle && (
        <BundleConfigurator
          bundle={configuringBundle}
          onClose={() => setConfiguringBundle(null)}
          onConfirm={configuredBundleAdd}
        />
      )}
    </div>
  );
}
