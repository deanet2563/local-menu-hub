import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { cart, useCart } from "@/lib/cart";
import { useCustomerCatalog, type CatalogItem } from "@/hooks/useCustomerCatalog";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { SponsorCard } from "@/components/customer/SponsorCard";
import { ProductConfigurator, type ConfigurableProduct } from "@/components/customer/ProductConfigurator";

// ============================================================
// MyTree — Food Hub (`/hub`). Food-only browsing, split out from the
// general Home overview per the approved wireframe. Reuses HubHome's
// data hook (useCustomerCatalog) instead of running a second copy of
// the shops/menu-items query — see the reuse notes below and in the
// task report.
//
// ร้านอาหาร / เครื่องดื่ม-ขนม segment toggle: the shops/menu_items
// schema has no food-vs-drink field (only a free-text `category`),
// so this is visual-only for now — it does not filter the grid.
// Wire it for real once such a field exists.
// ============================================================

type Segment = "food" | "drink";

export function FoodHub() {
  const { items, loading, orderedShops, locationState, refreshNearbyShops, cats, shopName } = useCustomerCatalog();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>("food");
  const [configuring, setConfiguring] = useState<CatalogItem | null>(null);
  const c = useCart();

  const filtered = items.filter(
    (i) => (!cat || i.category === cat) && (!q || i.name.includes(q) || shopName(i.shop_id).includes(q))
  );

  function quickAdd(input: {
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
    for (let n = 0; n < input.qty; n += 1) cart.add(payload, { allowMultipleShops: true });
    setConfiguring(null);
  }

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  const nearbyShops = orderedShops;
  const midpoint = Math.ceil(nearbyShops.length / 2);
  const shopsBeforeSponsor = nearbyShops.slice(0, midpoint);
  const shopsAfterSponsor = nearbyShops.slice(midpoint);

  return (
    <div className="pb-24 bg-[#e6ede4]/40">
      <div className="p-4 space-y-3 bg-white">
        <div>
          <h1 className="text-xl font-bold text-[#28432f]">🍜 อาหาร</h1>
          <p className="text-xs text-gray-500">เลือกเมนูและร้านอาหารใกล้คุณ</p>
        </div>

        <input
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
          placeholder="ค้นหาอาหาร หรือร้าน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2 rounded-full bg-[#e6ede4] p-1">
          <button
            type="button"
            onClick={() => setSegment("food")}
            className={`rounded-full py-1.5 text-sm font-medium transition ${segment === "food" ? "bg-[#3f6b4a] text-white" : "text-[#28432f]"}`}
          >
            ร้านอาหาร
          </button>
          <button
            type="button"
            onClick={() => setSegment("drink")}
            className={`rounded-full py-1.5 text-sm font-medium transition ${segment === "drink" ? "bg-[#3f6b4a] text-white" : "text-[#28432f]"}`}
          >
            เครื่องดื่ม-ขนม
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCat(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${!cat ? "bg-[#3f6b4a] text-white" : "bg-white border border-gray-200"}`}
          >
            ทั้งหมด
          </button>
          {cats.map((cc) => (
            <button
              key={cc}
              onClick={() => setCat(cc)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${cat === cc ? "bg-[#3f6b4a] text-white" : "bg-white border border-gray-200"}`}
            >
              {cc}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h2 className="text-sm font-bold text-[#28432f]">เมนูแนะนำตอนนี้</h2>
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((i) => (
            <div key={i.item_id} className="rounded-xl overflow-hidden border border-gray-100 bg-white">
              <Link to="/shop/$shopId" params={{ shopId: i.shop_id }}>
                <img src={i.image_url ?? ""} alt={i.name} className="w-full aspect-square object-cover bg-gray-100" />
              </Link>
              <div className="p-2 space-y-1">
                <p className="text-sm font-medium truncate">{i.name}</p>
                <p className="text-xs text-gray-400 truncate">{shopName(i.shop_id)}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#a85f2c]">฿{i.price}</p>
                  <button
                    type="button"
                    onClick={() => setConfiguring(i)}
                    className="rounded-lg bg-[#3f6b4a] text-white text-xs px-2.5 py-1"
                  >
                    ＋ เพิ่ม
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-2 text-sm text-gray-400 py-6 text-center">ไม่พบเมนูที่ตรงกับการค้นหา</p>}
        </div>
      </div>

      <SponsorCard label="สปอนเซอร์" title="ร้านค้าแนะนำประจำสัปดาห์" subtitle="พื้นที่โฆษณาสำหรับพาร์ทเนอร์" />

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#28432f]">ร้านใกล้คุณ</p>
          <button
            type="button"
            onClick={() => void refreshNearbyShops()}
            disabled={locationState === "loading"}
            className="shrink-0 text-xs text-[#3f6b4a] disabled:opacity-50"
          >
            {locationState === "loading" ? "📍 กำลังค้นหา..." : "📍 อัปเดตตำแหน่ง"}
          </button>
        </div>

        <div className="space-y-2">
          {shopsBeforeSponsor.map((s) => (
            <Link
              key={s.shop_id}
              to="/shop/$shopId"
              params={{ shopId: s.shop_id }}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2"
            >
              <img src={s.logo_url ?? ""} alt={s.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">{s.category}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#e6ede4] px-2 py-0.5 text-[11px] font-medium text-[#3f6b4a]">เปิดอยู่</span>
            </Link>
          ))}
        </div>

        {shopsAfterSponsor.length > 0 && <SponsorCard label="สปอนเซอร์" title="โปรโมชันพิเศษวันนี้" subtitle="พื้นที่โฆษณาสำหรับพาร์ทเนอร์" />}

        <div className="space-y-2">
          {shopsAfterSponsor.map((s) => (
            <Link
              key={s.shop_id}
              to="/shop/$shopId"
              params={{ shopId: s.shop_id }}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2"
            >
              <img src={s.logo_url ?? ""} alt={s.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">{s.category}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#e6ede4] px-2 py-0.5 text-[11px] font-medium text-[#3f6b4a]">เปิดอยู่</span>
            </Link>
          ))}
        </div>

        {nearbyShops.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">ไม่พบร้านใกล้คุณ</p>}
      </div>

      <FloatingCartBar cart={c} />

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
          onConfirm={quickAdd}
        />
      )}
    </div>
  );
}
