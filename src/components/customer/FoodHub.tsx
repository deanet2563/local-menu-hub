import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cart, useCart } from "@/lib/cart";
import { useCustomerCatalog, type CatalogShop, type HubCatalogItem } from "@/hooks/useCustomerCatalog";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { ProductConfigurator, type ConfigurableProduct } from "@/components/customer/ProductConfigurator";

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
}

function MapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5" aria-hidden="true"><path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>;
}

function ImageWithFallback({ src, alt, kind }: { src: string | null; alt: string; kind: "shop" | "food" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="flex h-full w-full items-center justify-center bg-[#EEF4EB] text-2xl" role="img" aria-label={`${alt} ไม่มีรูป`}>{kind === "shop" ? "🏪" : "🍽️"}</div>;
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

function ShopCard({ shop }: { shop: CatalogShop }) {
  const content = (
    <>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
        <ImageWithFallback src={shop.logo_url} alt={shop.name} kind="shop" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-extrabold text-[#1F3D2A]">{shop.name}</h3>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${shop.is_open ? "bg-[#E5F6E9] text-[#087A31]" : "bg-[#F0F1EF] text-[#747B76]"}`}>
            {shop.is_open ? "เปิดอยู่" : "ปิดอยู่"}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-[#77837B]">{shop.category || "ร้านอาหารในพื้นที่"}</p>
        <p className="mt-1 text-[11px] font-semibold text-[#506459]">
          {shop.distance_km == null ? "ดูรายละเอียดร้าน" : `${shop.distance_km.toFixed(1)} กม.`}
        </p>
      </div>
    </>
  );

  const className = `flex min-w-0 items-center gap-3 rounded-2xl border border-[#E4EBE3] bg-white p-3 shadow-[0_5px_16px_rgba(37,69,46,0.05)] ${shop.is_open ? "" : "opacity-75"}`;
  return (
    <Link
      to="/shop/$shopId"
      params={{ shopId: shop.shop_id }}
      className={className}
      aria-label={shop.is_open ? `เปิดร้าน ${shop.name}` : `ดูเมนูร้าน ${shop.name} ร้านปิดอยู่`}
    >
      {content}
    </Link>
  );
}

function MenuCard({
  item,
  shopName,
  onAdd,
}: {
  item: HubCatalogItem;
  shopName: string;
  onAdd: () => void;
}) {
  const canAdd = item.is_available && item.shop_is_open;
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[#E5EBE4] bg-white shadow-[0_5px_16px_rgba(37,69,46,0.05)]">
      <Link to="/shop/$shopId" params={{ shopId: item.shop_id }} className="block aspect-[4/3] overflow-hidden">
        <ImageWithFallback src={item.image_url} alt={item.name} kind="food" />
      </Link>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-extrabold text-[#203D2A]">{item.name}</h3>
          {!item.shop_is_open ? (
            <span className="shrink-0 rounded-full bg-[#F0F1EF] px-2 py-1 text-[10px] font-bold text-[#747B76]">ร้านปิด</span>
          ) : !item.is_available ? (
            <span className="shrink-0 rounded-full bg-[#FFF1E5] px-2 py-1 text-[10px] font-bold text-[#A94A0E]">ยังไม่พร้อมขาย</span>
          ) : (
            <span className="shrink-0 rounded-full bg-[#E5F6E9] px-2 py-1 text-[10px] font-bold text-[#087A31]">พร้อมขาย</span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-[#7A867E]">{shopName}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-sm font-black text-[#B64C0D]">฿{Number(item.price).toLocaleString("th-TH")}</p>
          <button
            type="button"
            disabled={!canAdd}
            onClick={onAdd}
            aria-label={canAdd ? `เพิ่ม ${item.name} ลงตะกร้า` : `${item.name} ยังไม่สามารถสั่งได้`}
            className="min-h-10 rounded-xl bg-[#EB681B] px-3 text-xs font-bold text-white shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:bg-[#D6DAD6] disabled:text-[#7F8881]"
          >
            {canAdd ? "+ เพิ่ม" : "สั่งไม่ได้"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function FoodHub() {
  const {
    hubItems,
    allOrderedShops,
    catalogState,
    catalogError,
    reloadCatalog,
    locationState,
    refreshNearbyShops,
    shopName,
    shopKeywords,
  } = useCustomerCatalog({ includeHubItems: true });

  const currentCart = useCart();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [shopFilter, setShopFilter] = useState<"all" | "open">("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available">("all");
  const [configuring, setConfiguring] = useState<HubCatalogItem | null>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase("th");

  const categories = useMemo(
    () => Array.from(new Set(hubItems.map((item) => item.category?.trim()).filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b, "th")),
    [hubItems],
  );

  const visibleItems = useMemo(() => hubItems.filter((item) => {
    const matchesCategory = !category || item.category === category;
    const matchesAvailability = availabilityFilter === "all" || item.is_available;
    const matchesShopState = shopFilter === "all" || item.shop_is_open;
    const haystack = `${item.name} ${item.category ?? ""} ${shopName(item.shop_id)} ${shopKeywords(item.shop_id)}`.toLocaleLowerCase("th");
    return matchesCategory && matchesAvailability && matchesShopState && (!normalizedQuery || haystack.includes(normalizedQuery));
  }), [hubItems, category, availabilityFilter, shopFilter, normalizedQuery, shopName, shopKeywords]);

  const visibleShops = useMemo(() => allOrderedShops.filter((shop) => {
    if (shopFilter === "open" && !shop.is_open) return false;
    if (category) {
      const hasCategory = hubItems.some((item) => item.shop_id === shop.shop_id && item.category === category);
      if (!hasCategory) return false;
    }
    if (!normalizedQuery) return true;
    const itemText = hubItems.filter((item) => item.shop_id === shop.shop_id).map((item) => `${item.name} ${item.category ?? ""}`).join(" ");
    const haystack = `${shop.name} ${shop.category ?? ""} ${shopKeywords(shop.shop_id)} ${itemText}`.toLocaleLowerCase("th");
    return haystack.includes(normalizedQuery);
  }), [allOrderedShops, hubItems, shopFilter, category, normalizedQuery, shopKeywords]);

  const openShops = visibleShops.filter((shop) => shop.is_open);
  const closedShops = visibleShops.filter((shop) => !shop.is_open);

  function addConfigured(input: {
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

    const firstResult = cart.add(payload);
    if (firstResult === "different_shop") {
      const confirmed = window.confirm("ในตะกร้ามีสินค้าจากร้านอื่น ต้องการล้างตะกร้าเดิมและเพิ่มเมนูจากร้านนี้หรือไม่?");
      if (!confirmed) return;
      cart.add(payload, { force: true });
    }
    for (let n = 1; n < input.qty; n += 1) cart.add(payload);
    setConfiguring(null);
  }

  return (
    <div className="min-h-screen bg-[#F7F8F3] pb-32 text-[#183B27]">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[#E4EAE2] bg-[#FFFDF8] px-4 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#EB681B]">MYTREE FOOD HUB</p>
              <h1 className="mt-0.5 text-xl font-black text-[#075B28]">ร้านอาหารและเมนูในชุมชน</h1>
            </div>
            <Link to="/map" aria-label="เปิดแผนที่ร้านอาหาร" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#DDE7DD] bg-white text-[#087A31]">
              <MapIcon />
            </Link>
          </div>

          <label className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-[#DDE7DC] bg-white px-4 shadow-[0_4px_14px_rgba(41,74,50,0.05)] focus-within:border-[#77B888] focus-within:ring-2 focus-within:ring-[#D9F0DE]">
            <span className="text-[#EB681B]"><SearchIcon /></span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาร้าน เมนู หรือประเภทอาหาร"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#203D2A] outline-none placeholder:text-[#919B94]"
            />
            {query && <button type="button" onClick={() => setQuery("")} className="min-h-9 px-1 text-xs font-bold text-[#6D786F]">ล้าง</button>}
          </label>
        </header>

        <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8">
          <section aria-labelledby="category-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="category-title" className="text-base font-black">เลือกหมวดอาหาร</h2>
              <span className="text-xs font-semibold text-[#77837B]">{categories.length} หมวดจากร้านจริง</span>
            </div>
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
              <button type="button" onClick={() => setCategory(null)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold ${category === null ? "border-[#087A31] bg-[#E5F6E9] text-[#075B28]" : "border-[#E1E7DF] bg-white text-[#506057]"}`}>ทั้งหมด</button>
              {categories.map((entry) => (
                <button key={entry} type="button" onClick={() => setCategory(entry)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold ${category === entry ? "border-[#087A31] bg-[#E5F6E9] text-[#075B28]" : "border-[#E1E7DF] bg-white text-[#506057]"}`}>{entry}</button>
              ))}
            </div>
          </section>

          <section aria-label="ตัวกรอง" className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShopFilter("all")} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${shopFilter === "all" ? "border-[#087A31] bg-[#E5F6E9] text-[#075B28]" : "border-[#E1E7DF] bg-white text-[#5C675F]"}`}>ร้านทั้งหมด</button>
            <button type="button" onClick={() => setShopFilter("open")} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${shopFilter === "open" ? "border-[#087A31] bg-[#E5F6E9] text-[#075B28]" : "border-[#E1E7DF] bg-white text-[#5C675F]"}`}>ร้านเปิดอยู่</button>
            <button type="button" onClick={() => setAvailabilityFilter(availabilityFilter === "available" ? "all" : "available")} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${availabilityFilter === "available" ? "border-[#EB681B] bg-[#FFF1E5] text-[#A94A0E]" : "border-[#E1E7DF] bg-white text-[#5C675F]"}`}>เมนูพร้อมขาย</button>
            <button type="button" onClick={() => void refreshNearbyShops()} disabled={locationState === "loading"} className="min-h-10 rounded-xl border border-[#E1E7DF] bg-white px-3 text-xs font-bold text-[#087A31] disabled:opacity-50">
              {locationState === "loading" ? "กำลังหาตำแหน่ง…" : "ใกล้ฉัน"}
            </button>
          </section>

          {locationState === "error" && (
            <p className="rounded-2xl bg-[#F0F3EF] px-4 py-3 text-xs text-[#68746C]">
              ไม่สามารถอ่านตำแหน่งได้ จึงยังแสดงร้านและค้นหาได้ตามปกติโดยไม่เรียงระยะทาง
            </p>
          )}

          {catalogState === "loading" && (
            <section aria-label="กำลังโหลดข้อมูล" className="space-y-3">
              <div className="h-5 w-40 animate-pulse rounded bg-[#E6ECE4]" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-2xl bg-white" />)}
              </div>
            </section>
          )}

          {catalogState === "error" && (
            <section className="rounded-3xl border border-[#F2CDAF] bg-[#FFF5EC] p-5">
              <h2 className="font-extrabold text-[#79340F]">โหลด Food Hub ไม่สำเร็จ</h2>
              <p className="mt-1 text-sm text-[#89583C]">{catalogError || "กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"}</p>
              <button type="button" onClick={() => void reloadCatalog()} className="mt-4 min-h-11 rounded-xl bg-[#EB681B] px-5 text-sm font-bold text-white">ลองอีกครั้ง</button>
            </section>
          )}

          {catalogState === "ready" && (
            <>
              <section aria-labelledby="menu-results-title">
                <div className="mb-3">
                  <h2 id="menu-results-title" className="text-lg font-black">เมนูอาหาร</h2>
                  <p className="mt-0.5 text-xs text-[#738078]">แสดงสถานะพร้อมขายและสถานะร้านจากข้อมูลจริง</p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {visibleItems.map((item) => (
                    <MenuCard
                      key={item.item_id}
                      item={item}
                      shopName={shopName(item.shop_id)}
                      onAdd={() => {
                        if (!item.is_available || !item.shop_is_open) return;
                        setConfiguring(item);
                      }}
                    />
                  ))}
                </div>
                {visibleItems.length === 0 && (
                  <div className="rounded-2xl border border-[#E2E8E0] bg-white px-4 py-8 text-center">
                    <p className="text-sm font-bold text-[#4F5E54]">
                      {hubItems.length === 0 ? "ยังไม่มีเมนูใน Food Hub" : "ไม่พบเมนูที่ตรงกับการค้นหา"}
                    </p>
                    <p className="mt-1 text-xs text-[#7A867E]">
                      {hubItems.length === 0 ? "เมื่อร้านเพิ่มเมนู ระบบจะแสดงที่นี่อัตโนมัติ" : "ลองล้างคำค้นหรือเลือกหมวดอื่น"}
                    </p>
                  </div>
                )}
              </section>

              <section aria-labelledby="shop-results-title">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 id="shop-results-title" className="text-lg font-black">ร้านที่ตรงกับการค้นหา</h2>
                    <p className="mt-0.5 text-xs text-[#738078]">ร้านเปิดอยู่แสดงก่อน ร้านปิดแยกไว้ด้านล่าง</p>
                  </div>
                  {locationState === "ready" && <span className="text-xs font-bold text-[#087A31]">ใช้ระยะทางจริงแล้ว</span>}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {openShops.map((shop) => <ShopCard key={shop.shop_id} shop={shop} />)}
                </div>
                {openShops.length === 0 && <p className="rounded-2xl border border-[#E2E8E0] bg-white px-4 py-6 text-center text-sm text-[#748077]">ไม่พบร้านเปิดที่ตรงกับตัวกรอง</p>}
              </section>

              {closedShops.length > 0 && (
                <section aria-labelledby="closed-shop-title">
                  <h2 id="closed-shop-title" className="mb-3 text-base font-black">ร้านปิดอยู่</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {closedShops.map((shop) => <ShopCard key={shop.shop_id} shop={shop} />)}
                  </div>
                </section>
              )}

              <section className="overflow-hidden rounded-3xl border border-[#CFE2D1] bg-[#EDF7ED] p-5 md:flex md:items-center md:justify-between md:gap-5">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#EB681B]">MYTREE LOCAL MAP</p>
                  <h2 className="mt-1 text-xl font-black text-[#075B28]">ดูร้านทั้งหมดบนแผนที่</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#53675A]">เปิดดูตำแหน่งร้านในพื้นที่โดยไม่ต้องรอ GPS เพื่อใช้งาน Food Hub</p>
                </div>
                <Link to="/map" className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-[#087A31] px-5 text-sm font-bold text-white md:mt-0 md:shrink-0">เปิดแผนที่</Link>
              </section>
            </>
          )}
        </main>
      </div>

      <FloatingCartBar cart={currentCart} />

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
          onConfirm={addConfigured}
        />
      )}
    </div>
  );
}
