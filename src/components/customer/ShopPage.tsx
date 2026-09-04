import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { publicSupabase } from "@/lib/supabase";
import { cart, useCart, cartCount, cartTotal } from "@/lib/cart";
import { ProductConfigurator, type ConfigurableProduct } from "@/components/customer/ProductConfigurator";

type Shop = {
  shop_id: string; name: string; category: string | null; logo_url: string | null; cover_url: string | null;
  description: string | null; phone: string | null; address: string | null; google_maps_url: string | null;
  website_url: string | null; facebook_url: string | null; instagram_url: string | null; tiktok_url: string | null; line_url: string | null;
  is_open: boolean | null; delivery_note: string | null; is_approved: boolean; is_banned: boolean;
};
type Item = { item_id: string; shop_id: string; name: string; price: number; image_url: string | null; category: string | null };

function setNumber(setId: string | null | undefined) {
  const m = /^customer-set-(\d+)$/.exec(setId ?? "");
  return m ? Number(m[1]) : 0;
}

function ContactLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noreferrer" className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700">{label}</a>;
}

export function ShopPage({ shopId }: { shopId: string }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<Item | null>(null);
  const [activeSetNo, setActiveSetNo] = useState(1);
  const [setCount, setSetCount] = useState(1);
  const c = useCart();

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: m }] = await Promise.all([
        publicSupabase.from("shops").select("shop_id,name,category,logo_url,cover_url,description,phone,address,google_maps_url,website_url,facebook_url,instagram_url,tiktok_url,line_url,is_open,delivery_note,is_approved,is_banned").eq("shop_id", shopId).maybeSingle(),
        publicSupabase.from("menu_items").select("item_id,shop_id,name,price,image_url,category").eq("shop_id", shopId).eq("is_available", true),
      ]);
      setShop(s as Shop);
      setItems((m as Item[]) ?? []);
      setLoading(false);
    })();
  }, [shopId]);

  useEffect(() => {
    if (c.shopId !== shopId) return;
    const maxExisting = c.items.reduce((max, item) => Math.max(max, setNumber(item.setId)), 0);
    if (maxExisting > setCount) setSetCount(maxExisting);
  }, [c.items, c.shopId, shopId, setCount]);

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (!shop) return <p className="p-4 text-sm text-gray-400">ไม่พบร้าน</p>;
  if (!shop.is_approved || shop.is_banned) return <p className="p-4 text-sm text-gray-400">ร้านนี้ยังไม่พร้อมให้บริการ</p>;

  const cats = Array.from(new Set(items.map((i) => i.category || "อื่นๆ")));
  const activeSetId = `customer-set-${activeSetNo}`;
  const activeSetName = `ชุด ${activeSetNo}`;
  const qtyOf = (id: string) => c.items.filter((i) => i.itemId === id && i.setId === activeSetId).reduce((n, i) => n + i.qty, 0);
  const activeSetCount = c.items.filter((i) => i.setId === activeSetId).reduce((n, i) => n + i.qty, 0);
  const hasContact = Boolean(shop.phone || shop.line_url || shop.facebook_url || shop.instagram_url || shop.tiktok_url || shop.website_url || shop.google_maps_url || shop.address);

  function addSet() {
    const next = setCount + 1;
    setSetCount(next);
    setActiveSetNo(next);
  }

  function configuredAdd(input: { product: ConfigurableProduct; qty: number; options: Parameters<typeof cart.add>[0]["options"]; note: string | null }) {
    const payload = {
      itemId: input.product.itemId, shopId: input.product.shopId, name: input.product.name, price: input.product.price,
      imageUrl: input.product.imageUrl, options: input.options, note: input.note, setId: activeSetId, setName: activeSetName,
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

  return (
    <div className="pb-28">
      {shop.cover_url && <img src={shop.cover_url} alt={`${shop.name} cover`} className="h-40 w-full object-cover bg-gray-100" />}
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <Link to="/" className="text-gray-400 text-lg">‹</Link>
        <img src={shop.logo_url ?? ""} alt={shop.name} className="w-14 h-14 rounded-xl object-cover bg-gray-100" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{shop.name}</h1>
          <p className="text-xs text-gray-400 truncate">{shop.category}{shop.delivery_note ? ` · ${shop.delivery_note}` : ""}</p>
        </div>
      </div>

      {(shop.description || hasContact) && (
        <section className="mx-4 mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">เกี่ยวกับร้าน / ติดต่อเรา</p>
            {shop.description && <p className="mt-1 text-xs leading-5 text-gray-500 whitespace-pre-wrap">{shop.description}</p>}
          </div>
          {shop.address && <p className="text-xs text-gray-500">📍 {shop.address}</p>}
          <div className="flex flex-wrap gap-2">
            {shop.phone && <a href={`tel:${shop.phone.replace(/\s/g, "")}`} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700">โทรหาร้าน</a>}
            <ContactLink href={shop.line_url} label="LINE" />
            <ContactLink href={shop.facebook_url} label="Facebook" />
            <ContactLink href={shop.instagram_url} label="Instagram" />
            <ContactLink href={shop.tiktok_url} label="TikTok" />
            <ContactLink href={shop.website_url} label="Website" />
            <ContactLink href={shop.google_maps_url} label="Google Maps" />
          </div>
        </section>
      )}

      <div className="sticky top-0 z-20 bg-white border-b border-orange-100 px-4 py-3 mt-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-sm text-gray-500 shrink-0">กำลังเลือก</span>
          {Array.from({ length: setCount }, (_, idx) => idx + 1).map((n) => {
            const count = c.items.filter((i) => i.setId === `customer-set-${n}`).reduce((sum, i) => sum + i.qty, 0);
            const active = n === activeSetNo;
            return <button type="button" key={n} onClick={() => setActiveSetNo(n)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border ${active ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200"}`}>ชุด {n}{count > 0 ? ` (${count})` : ""}</button>;
          })}
          <button type="button" onClick={addSet} className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-orange-600 border border-dashed border-orange-400 bg-white">＋ เพิ่มชุด</button>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">{activeSetCount > 0 ? `${activeSetName} มี ${activeSetCount} ชิ้น · เลือกสินค้าเพิ่มได้อิสระ` : `${activeSetName} · เลือกสินค้าอะไรก็ได้จากเมนูด้านล่าง`}</p>
      </div>

      {cats.map((cc) => (
        <div key={cc} className="px-4 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{cc}</p>
          <div className="space-y-3">
            {items.filter((i) => (i.category || "อื่นๆ") === cc).map((i) => (
              <div key={i.item_id} className="flex gap-3 items-center">
                <img src={i.image_url ?? ""} alt={i.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.name}</p>
                  <p className="text-sm text-orange-600">฿{i.price}</p>
                  {qtyOf(i.item_id) > 0 && <p className="text-[11px] text-gray-400">ใน{activeSetName} {qtyOf(i.item_id)} ชิ้น</p>}
                </div>
                <button onClick={() => setConfiguring(i)} className="rounded-lg bg-orange-500 text-white text-sm px-3 py-1.5">{qtyOf(i.item_id) > 0 ? "เพิ่มอีก" : "เพิ่ม"}</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {cartCount(c) > 0 && <Link to="/cart" className="fixed z-30 left-4 right-4 bottom-4 rounded-xl bg-orange-500 text-white px-4 py-3 flex justify-between text-sm font-medium"><span>ดูตะกร้า ({cartCount(c)})</span><span>฿{cartTotal(c)}</span></Link>}

      {configuring && <ProductConfigurator product={{ itemId: configuring.item_id, shopId: configuring.shop_id, name: configuring.name, price: configuring.price, imageUrl: configuring.image_url }} onClose={() => setConfiguring(null)} onConfirm={configuredAdd} />}
    </div>
  );
}