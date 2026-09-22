import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cart, useCart } from "@/lib/cart";
import { useCustomerCatalog, type CatalogItem, type CatalogShop } from "@/hooks/useCustomerCatalog";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { ProductConfigurator, type ConfigurableProduct } from "@/components/customer/ProductConfigurator";
import { bucketKeyForCategory } from "@/lib/foodHubCategories";

const FOOD_CATEGORIES = [
  { key: "single-dish", label: "อาหารจานเดียว", icon: "🍛" },
  { key: "noodles", label: "ก๋วยเตี๋ยว", icon: "🍜" },
  { key: "snacks", label: "ของว่าง", icon: "🥟" },
  { key: "bakery", label: "เบเกอรี่", icon: "🥐" },
  { key: "desserts", label: "ของหวาน", icon: "🍨" },
  { key: "drinks", label: "เครื่องดื่ม", icon: "🥤" },
  { key: "other", label: "อื่น ๆ", icon: "🍽️" },
] as const;

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>;
}

function ImageWithFallback({ src, alt, kind }: { src: string | null; alt: string; kind: "shop" | "food" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="flex h-full w-full items-center justify-center bg-[#EEF4EB] text-2xl" role="img" aria-label={`${alt} ไม่มีรูป`}>{kind === "shop" ? "🏪" : "🍽️"}</div>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

function ShopCard({ shop }: { shop: CatalogShop }) {
  const content = <>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl"><ImageWithFallback src={shop.logo_url} alt={shop.name} kind="shop" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-extrabold text-[#1F3D2A]">{shop.name}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${shop.is_open ? "bg-[#E5F6E9] text-[#087A31]" : "bg-[#F0F1EF] text-[#747B76]"}`}>{shop.is_open ? "เปิดอยู่" : "ปิดอยู่"}</span></div>
        <p className="mt-1 truncate text-xs text-[#77837B]">{shop.category || "ร้านอาหารใกล้บ้าน"}</p>
        <p className="mt-1 text-[11px] font-semibold text-[#506459]">{shop.distance_km == null ? "ดูรายละเอียดร้าน" : `${shop.distance_km.toFixed(1)} กม.`}</p>
      </div>
      {shop.is_open && <span className="text-[#9AA59E] transition-transform group-hover:translate-x-0.5"><ArrowIcon /></span>}
    </>;
  const className = `group flex min-w-0 items-center gap-3 rounded-2xl border border-[#E4EBE3] bg-white p-3 shadow-[0_5px_16px_rgba(37,69,46,0.05)] ${shop.is_open ? "" : "cursor-not-allowed grayscale-[20%]"}`;
  return shop.is_open
    ? <Link to="/shop/$shopId" params={{ shopId: shop.shop_id }} className={className}>{content}</Link>
    : <div className={className} aria-disabled="true" title="ร้านยังไม่เปิดรับออเดอร์">{content}</div>;
}

function MenuCard({ item, shopName, onAdd }: { item: CatalogItem; shopName: string; onAdd: () => void }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[#E5EBE4] bg-white shadow-[0_5px_16px_rgba(37,69,46,0.05)]">
      <Link to="/shop/$shopId" params={{ shopId: item.shop_id }} className="block aspect-[4/3] overflow-hidden"><ImageWithFallback src={item.image_url} alt={item.name} kind="food" /></Link>
      <div className="p-3"><h3 className="truncate text-sm font-extrabold text-[#203D2A]">{item.name}</h3><p className="mt-0.5 truncate text-xs text-[#7A867E]">{shopName}</p><div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm font-black text-[#B64C0D]">฿{Number(item.price).toLocaleString("th-TH")}</p><button type="button" onClick={onAdd} aria-label={`เพิ่ม ${item.name} ลงตะกร้า`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EB681B] text-xl font-bold leading-none text-white shadow-sm active:scale-95">+</button></div></div>
    </article>
  );
}

export function HomeOverview() {
  const { items, allOrderedShops, catalogState, catalogError, reloadCatalog, locationState, refreshNearbyShops, shopName } = useCustomerCatalog();
  const currentCart = useCart();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<CatalogItem | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("th");

  const visibleShops = useMemo(() => allOrderedShops.filter((shop) => !normalizedQuery || shop.name.toLocaleLowerCase("th").includes(normalizedQuery) || (shop.category ?? "").toLocaleLowerCase("th").includes(normalizedQuery)), [allOrderedShops, normalizedQuery]);
  const visibleItems = useMemo(() => items.filter((item) => {
    const itemBucket = bucketKeyForCategory(item.category);
    const matchesCategory = !category || (category === "other" ? itemBucket === null : itemBucket === category);
    const haystack = `${item.name} ${item.category ?? ""} ${shopName(item.shop_id)}`.toLocaleLowerCase("th");
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  }), [items, category, normalizedQuery, shopName]);

  function addConfigured(input: { product: ConfigurableProduct; qty: number; options: Parameters<typeof cart.add>[0]["options"]; note: string | null }) {
    const payload = { itemId: input.product.itemId, shopId: input.product.shopId, name: input.product.name, price: input.product.price, imageUrl: input.product.imageUrl, options: input.options, note: input.note };
    const firstResult = cart.add(payload);
    if (firstResult === "different_shop") {
      if (!window.confirm("ในตะกร้ามีสินค้าจากร้านอื่น ต้องการล้างตะกร้าเดิมและเพิ่มเมนูจากร้านนี้หรือไม่?")) return;
      cart.add(payload, { force: true });
    }
    for (let n = 1; n < input.qty; n += 1) cart.add(payload);
    setConfiguring(null);
  }

  const openShops = visibleShops.filter((shop) => shop.is_open);
  const closedShops = visibleShops.filter((shop) => !shop.is_open);

  return (
    <div className="min-h-screen bg-[#F7F8F3] pb-32 text-[#183B27]">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[#E4EAE2] bg-[#FFFDF8] px-4 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:px-6">
          <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><img src="/brand/mytree-logo.png" alt="MyTree" className="h-11 w-11 shrink-0 object-contain" /><div className="min-w-0"><p className="text-lg font-black leading-tight text-[#075B28]">MyTree</p><Link to="/map" className="flex min-h-6 items-center gap-1 text-xs font-semibold text-[#65736A]" aria-label="เปลี่ยนพื้นที่บนแผนที่"><span className="truncate">สัมมากร</span><span className="text-[#EB681B]">เปลี่ยนพื้นที่</span></Link></div></div><Link to="/account" aria-label="บัญชีของฉัน" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#DEE7DD] bg-white text-[#087A31]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" /></svg></Link></div>
          <label className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-[#DDE7DC] bg-white px-4 shadow-[0_4px_14px_rgba(41,74,50,0.05)] focus-within:border-[#77B888] focus-within:ring-2 focus-within:ring-[#D9F0DE]"><span className="text-[#EB681B]"><SearchIcon /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาร้าน เมนู หรือประเภทอาหาร" className="min-w-0 flex-1 bg-transparent text-sm text-[#203D2A] outline-none placeholder:text-[#919B94]" />{query && <button type="button" onClick={() => setQuery("")} className="min-h-9 px-1 text-xs font-bold text-[#6D786F]">ล้าง</button>}</label>
        </header>

        <main className="space-y-7 px-4 py-5 sm:px-6 lg:px-8">
          <section aria-labelledby="food-category-title"><div className="mb-3 flex items-center justify-between"><h2 id="food-category-title" className="text-lg font-black">เลือกตามหมวด</h2><Link to="/hub" className="flex min-h-10 items-center gap-1 text-sm font-bold text-[#087A31]">ดูทั้งหมด <ArrowIcon /></Link></div><div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">{FOOD_CATEGORIES.map((entry) => <button key={entry.key} type="button" onClick={() => setCategory(category === entry.key ? null : entry.key)} className={`flex min-w-[82px] snap-start flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-bold transition ${category === entry.key ? "border-[#72B685] bg-[#E5F6E9] text-[#075B28]" : "border-[#E3E9E1] bg-white text-[#3E5547]"}`}><span className="text-2xl">{entry.icon}</span><span className="whitespace-nowrap">{entry.label}</span></button>)}</div></section>

          {catalogState === "loading" && <section aria-label="กำลังโหลดข้อมูล" className="space-y-3"><div className="h-5 w-44 animate-pulse rounded bg-[#E6ECE4]" /><div className="grid gap-3 md:grid-cols-2"><div className="h-24 animate-pulse rounded-2xl bg-white" /><div className="h-24 animate-pulse rounded-2xl bg-white" /></div></section>}
          {catalogState === "error" && <section className="rounded-3xl border border-[#F2CDAF] bg-[#FFF5EC] p-5"><h2 className="font-extrabold text-[#79340F]">โหลดร้านอาหารไม่สำเร็จ</h2><p className="mt-1 text-sm text-[#89583C]">{catalogError || "กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"}</p><button type="button" onClick={() => void reloadCatalog()} className="mt-4 min-h-11 rounded-xl bg-[#EB681B] px-5 text-sm font-bold text-white">ลองอีกครั้ง</button></section>}

          {catalogState === "ready" && <>
            <section aria-labelledby="open-nearby-title"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="open-nearby-title" className="text-lg font-black">ร้านเปิดใกล้คุณ</h2><p className="mt-0.5 text-xs text-[#738078]">เลือกร้านที่พร้อมรับออเดอร์ตอนนี้</p></div><button type="button" onClick={() => void refreshNearbyShops()} disabled={locationState === "loading"} className="min-h-10 shrink-0 text-xs font-bold text-[#087A31] disabled:opacity-50">{locationState === "loading" ? "กำลังหาตำแหน่ง…" : "อัปเดตตำแหน่ง"}</button></div><div className="grid gap-3 md:grid-cols-2">{openShops.slice(0, 6).map((shop) => <ShopCard key={shop.shop_id} shop={shop} />)}</div>{openShops.length === 0 && <div className="rounded-2xl border border-[#E2E8E0] bg-white px-4 py-7 text-center text-sm text-[#748077]">{query ? "ไม่พบร้านเปิดที่ตรงกับคำค้น" : "ขณะนี้ยังไม่มีร้านเปิดรับออเดอร์"}</div>}{locationState === "error" && <p className="mt-2 text-xs text-[#7A847D]">ยังไม่สามารถอ่านตำแหน่งได้ จึงแสดงร้านโดยไม่เรียงระยะทาง</p>}</section>

            <section className="overflow-hidden rounded-3xl border border-[#CFE2D1] bg-[#EDF7ED] p-5 md:flex md:items-center md:justify-between md:gap-5"><div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#EB681B]">MYTREE LOCAL MAP</p><h2 className="mt-1 text-xl font-black text-[#075B28]">ดูร้านอาหารใกล้ฉันบนแผนที่</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#53675A]">ค้นหาร้านในพื้นที่ พร้อมพัฒนาข้อมูลซอย ทางเข้า และจุดสังเกตที่คนในพื้นที่ใช้จริง</p></div><Link to="/map" className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-[#087A31] px-5 text-sm font-bold text-white md:mt-0 md:shrink-0">เปิดแผนที่</Link></section>

            <section aria-labelledby="menu-title"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="menu-title" className="text-lg font-black">{category ? `เมนู ${FOOD_CATEGORIES.find((entry) => entry.key === category)?.label ?? category}` : "เมนูน่าสั่งตอนนี้"}</h2><p className="mt-0.5 text-xs text-[#738078]">เมนูที่พร้อมขายจากร้านที่เปิดอยู่</p></div><Link to="/hub" className="flex min-h-10 items-center gap-1 text-sm font-bold text-[#087A31]">ดูเพิ่ม <ArrowIcon /></Link></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{visibleItems.slice(0, 8).map((item) => <MenuCard key={item.item_id} item={item} shopName={shopName(item.shop_id)} onAdd={() => setConfiguring(item)} />)}</div>{visibleItems.length === 0 && <div className="rounded-2xl border border-[#E2E8E0] bg-white px-4 py-7 text-center text-sm text-[#748077]">ไม่พบเมนูที่ตรงกับคำค้นหรือหมวดนี้</div>}</section>

            {closedShops.length > 0 && <section aria-labelledby="closed-shop-title"><h2 id="closed-shop-title" className="mb-3 text-base font-black">ร้านอื่นในพื้นที่</h2><div className="grid gap-3 opacity-90 md:grid-cols-2">{closedShops.slice(0, 4).map((shop) => <ShopCard key={shop.shop_id} shop={shop} />)}</div></section>}
            <section className="rounded-3xl border border-[#E4E9E1] bg-white p-5"><h2 className="font-black text-[#203D2A]">มีร้านอาหาร?</h2><p className="mt-1 text-sm leading-6 text-[#6D7A71]">สมัครเข้าร่วม MyTree ยืนยันตำแหน่งร้าน และใช้ MyTree POS ฟรีตามเงื่อนไขของระบบ</p><Link to="/sweet/signup" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#EB681B] px-4 text-sm font-bold text-[#B94A0C]">สมัครร้านค้ากับ MyTree</Link></section>
          </>}
        </main>
      </div>
      <FloatingCartBar cart={currentCart} />
      {configuring && <ProductConfigurator product={{ itemId: configuring.item_id, shopId: configuring.shop_id, name: configuring.name, price: configuring.price, imageUrl: configuring.image_url }} onClose={() => setConfiguring(null)} onConfirm={addConfigured} />}
    </div>
  );
}
