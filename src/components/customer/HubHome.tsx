import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import liff from "@line/liff";
import { ensureMyTreeSession, initLiff, LIFF_ID, MYTREE_SUPABASE_URL, publicSupabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";
import { useCart, cartCount, cartTotal } from "@/lib/cart";
import { buildStagingDiagnosticSnapshot, isStagingDiagnosticsDebugEnabled } from "@/lib/stagingDiagnostics";
import { MYTREE_WORKER_URL } from "@/lib/workerEndpoint";

type Shop = { shop_id: string; name: string; category: string | null; logo_url: string | null };
type Item = { item_id: string; shop_id: string; name: string; price: number; image_url: string | null; category: string | null };
type LocationState = "idle" | "loading" | "ready" | "error";

const LOCATION_REFRESH_MS = 2 * 60 * 1000;

function ProductCard({ item, shopName }: { item: Item; shopName: string }) {
  return (
    <Link to="/shop/$shopId" params={{ shopId: item.shop_id }} className="w-40 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm active:scale-[.98]">
      <img src={item.image_url ?? ""} alt={item.name} loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-cover" />
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{shopName}</p>
        <p className="mt-2 text-sm font-bold text-orange-600">฿{item.price}</p>
      </div>
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function HeaderActionIcon({ type }: { type: "favorites" | "notifications" }) {
  if (type === "favorites") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-4.4-9.2-8.7C1.2 9.1 3.3 5.5 6.8 5.5c2 0 3.4 1.1 4.2 2.4.8-1.3 2.2-2.4 4.2-2.4 3.5 0 5.6 3.6 4 6.8C19 16.6 12 21 12 21Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function mountStagingDiagnosticsPanel(snapshot: NonNullable<ReturnType<typeof buildStagingDiagnosticSnapshot>>): () => void {
  const existing = document.querySelector('[data-testid="staging-home-diagnostics"]');
  existing?.remove();
  const boolText = (value: boolean | null) => value === null ? "unknown" : value ? "true" : "false";
  const panel = document.createElement("section");
  panel.dataset.testid = "staging-home-diagnostics";
  panel.className = "sticky top-0 z-[60] border-b border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-slate-900 shadow-sm";
  panel.innerHTML = `<div class="mx-auto grid max-w-md grid-cols-1 gap-1 sm:grid-cols-2"><span>LIFF ID: ${snapshot.liffId}</span><span>Build: ${snapshot.buildSha}</span><span>isInClient: ${boolText(snapshot.isInClient)}</span><span>isLoggedIn: ${boolText(snapshot.isLoggedIn)}</span><span>MyTree session: ${boolText(snapshot.myTreeSessionReady)}</span><span>Supabase: ${snapshot.supabaseRef} (${snapshot.supabaseHost})</span><span class="sm:col-span-2">Worker: ${snapshot.workerHost}</span></div>`;
  document.body.prepend(panel);
  return () => panel.remove();
}

export function HubHome() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [openOnly, setOpenOnly] = useState(true);
  const [nearOrder, setNearOrder] = useState<string[] | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const lastLocationAt = useRef(0);
  const locating = useRef(false);
  const c = useCart();

  useEffect(() => {
    if (typeof window === "undefined" || !isStagingDiagnosticsDebugEnabled(window.location)) return;
    const { hostname } = window.location;
    let mounted = true;
    let unmountPanel: (() => void) | null = null;
    let myTreeSessionReady: boolean | null = null;
    const readLiffFlag = (reader: () => boolean): boolean | null => {
      try {
        return reader();
      } catch {
        return null;
      }
    };
    const renderPanel = () => {
      const snapshot = buildStagingDiagnosticSnapshot({
        hostname,
        liffId: LIFF_ID,
        supabaseUrl: MYTREE_SUPABASE_URL,
        workerUrl: MYTREE_WORKER_URL,
        isInClient: readLiffFlag(() => liff.isInClient()),
        isLoggedIn: readLiffFlag(() => liff.isLoggedIn()),
        buildSha: import.meta.env.VITE_CUSTOMER_BUILD_SHA,
        myTreeSessionReady,
      });
      if (!snapshot || !mounted) return;
      unmountPanel?.();
      unmountPanel = mountStagingDiagnosticsPanel(snapshot);
    };
    renderPanel();
    void initLiff().finally(renderPanel);
    void ensureMyTreeSession().then((session) => {
      myTreeSessionReady = session.status === "ready";
      renderPanel();
    }).catch(() => {
      myTreeSessionReady = false;
      renderPanel();
    });
    return () => {
      mounted = false;
      unmountPanel?.();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: shopRows }, { data: itemRows }] = await Promise.all([
        publicSupabase.from("shops").select("shop_id,name,category,logo_url").eq("is_open", true).eq("is_approved", true).eq("is_banned", false),
        publicSupabase
          .from("menu_items")
          .select("item_id,shop_id,name,price,image_url,category, shops!inner(is_open,is_approved,is_banned)")
          .eq("is_available", true)
          .eq("shops.is_open", true)
          .eq("shops.is_approved", true)
          .eq("shops.is_banned", false),
      ]);
      setShops((shopRows as Shop[]) ?? []);
      setItems((itemRows as Item[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    void refreshNearbyShops();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLocationAt.current >= LOCATION_REFRESH_MS) void refreshNearbyShops();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function refreshNearbyShops() {
    if (locating.current) return;
    locating.current = true;
    setLocationState("loading");
    try {
      const loc = await getCurrentLocation();
      const { data, error } = await publicSupabase.rpc("fn_shops_near_location", { p_lat: loc.lat, p_lng: loc.lng });
      if (error) throw error;
      setNearOrder(data ? (data as { shop_id: string }[]).map((row) => row.shop_id) : null);
      lastLocationAt.current = Date.now();
      setLocationState("ready");
    } catch {
      setLocationState("error");
    } finally {
      locating.current = false;
    }
  }

  const shopName = (id: string) => shops.find((shop) => shop.shop_id === id)?.name ?? "ร้าน MyTree";
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[], [items]);
  const orderedShops = useMemo(() => {
    const rank = nearOrder ? new Map(nearOrder.map((id, index) => [id, index])) : null;
    return [...shops].sort((a, b) => (rank?.get(a.shop_id) ?? 9999) - (rank?.get(b.shop_id) ?? 9999));
  }, [nearOrder, shops]);
  const visibleItems = useMemo(
    () => items.filter((item) => (!cat || item.category === cat) && (!q || item.name.includes(q) || shopName(item.shop_id).includes(q))),
    [cat, items, q, shops],
  );
  const sections = useMemo(
    () => categories
      .slice(0, 5)
      .map((category) => ({ category, items: (cat ? visibleItems : items).filter((item) => item.category === category).slice(0, 10) }))
      .filter((section) => section.items.length > 0),
    [cat, categories, items, visibleItems],
  );
  const filteredShops = openOnly ? orderedShops : shops;
  const locationLabel = locationState === "ready" ? "ตำแหน่งปัจจุบัน" : "ชุมชนใกล้คุณ";

  if (loading) return <div className="min-h-screen bg-[#f7f7f3] p-5 text-sm text-slate-500">กำลังเตรียมร้านใกล้คุณ...</div>;

  return (
    <div className="min-h-screen bg-[#f7f7f3] pb-24 text-slate-900">
      <header className="mx-auto max-w-md px-4 pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight text-slate-950">MyTree</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-700">Community Thailand</p>
            <p className="mt-3 truncate text-sm font-medium text-slate-600">📍 ส่งไปที่ {locationLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/favorites" className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95" aria-label="Favorites">
              <HeaderActionIcon type="favorites" />
            </Link>
            <Link to="/notifications" className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95" aria-label="Notifications">
              <HeaderActionIcon type="notifications" />
            </Link>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <span className="text-slate-400"><SearchIcon /></span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="ค้นหาใน MyTree" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <button type="button" onClick={() => setShowFilters(true)} className="rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm">ตัวกรอง</button>
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">รอบบ้านคุณ มีอะไรน่าสนใจ?</h1>
      </header>
      <main className="mx-auto max-w-md space-y-7">
        <section className="px-4">
          <div className="grid grid-cols-3 gap-2">
            <Link to="/food" className="rounded-2xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm">อาหาร</Link>
            <Link to="/community" className="rounded-2xl border border-emerald-100 bg-white px-3 py-3 text-sm font-bold text-emerald-800 shadow-sm">ชุมชน</Link>
            <Link to="/map" className="rounded-2xl border border-emerald-100 bg-white px-3 py-3 text-sm font-bold text-emerald-800 shadow-sm">แผนที่</Link>
          </div>
        </section>
        <section className="px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">ร้านใกล้คุณ</h2>
              <p className="mt-1 text-xs text-slate-500">{locationState === "ready" ? "เรียงตามตำแหน่งปัจจุบัน" : "เลือกดูร้านในชุมชนของคุณ"}</p>
            </div>
            <button type="button" onClick={() => void refreshNearbyShops()} disabled={locationState === "loading"} className="text-xs font-semibold text-orange-600 disabled:opacity-50">
              {locationState === "loading" ? "กำลังค้นหา" : "อัปเดตตำแหน่ง"}
            </button>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {filteredShops.slice(0, 8).map((shop) => (
              <Link key={shop.shop_id} to="/shop/$shopId" params={{ shopId: shop.shop_id }} className="w-20 shrink-0 text-center">
                <img src={shop.logo_url ?? ""} alt={shop.name} loading="lazy" className="mx-auto h-16 w-16 rounded-2xl bg-slate-200 object-cover" />
                <p className="mt-2 truncate text-xs font-medium">{shop.name}</p>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <div className="flex items-end justify-between px-4">
            <div>
              <h2 className="text-lg font-bold">กำลังฮิตใกล้คุณ</h2>
              <p className="mt-1 text-xs text-slate-500">เมนูจากหมวดที่มีให้บริการตอนนี้</p>
            </div>
            <span className="text-xs text-slate-400">{sections.length} หมวด</span>
          </div>
          {sections.map((section) => (
            <div key={section.category} className="mt-4">
              <div className="mb-2 flex items-center justify-between px-4">
                <h3 className="text-sm font-bold">{section.category}</h3>
                <button type="button" onClick={() => setCat(section.category)} className="text-xs font-semibold text-orange-600">ดูทั้งหมด</button>
              </div>
              <div className="flex gap-3 overflow-x-auto px-4 pb-1">
                {section.items.map((item) => <ProductCard key={item.item_id} item={item} shopName={shopName(item.shop_id)} />)}
              </div>
            </div>
          ))}
        </section>
        <section className="px-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">ชุมชน MyTree</h2>
                <p className="mt-1 text-sm text-slate-500">ข่าวสาร เพื่อนบ้าน และกิจกรรมในชุมชนกำลังจะมา</p>
              </div>
              <Link to="/community" className="shrink-0 text-xs font-semibold text-emerald-700">ดูพื้นที่</Link>
            </div>
          </div>
        </section>
        <section className="px-4">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/map" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">รอบตัวฉัน</h2>
              <p className="mt-1 text-xs text-slate-500">เตรียมพื้นที่แผนที่ชุมชน</p>
            </Link>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">บริการและตลาด</h2>
              <p className="mt-1 text-xs text-slate-500">ตัวอย่างพื้นที่ staging สำหรับอนาคต</p>
            </div>
          </div>
        </section>
        <section className="px-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold">เลือกตามหมวด</h2>
              <p className="mt-1 text-xs text-slate-500">ค้นพบของดีจากร้านหลายประเภท</p>
            </div>
            <button type="button" onClick={() => setCat(null)} className="text-xs font-semibold text-orange-600">ล้าง</button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setCat(null)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${!cat ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>ทั้งหมด</button>
            {categories.map((category) => (
              <button type="button" key={category} onClick={() => setCat(category)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${cat === category ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{category}</button>
            ))}
          </div>
        </section>
        <section className="px-4">
          <h2 className="text-lg font-bold">เมนูทั้งหมด</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {visibleItems.slice(0, 12).map((item) => <ProductCard key={item.item_id} item={item} shopName={shopName(item.shop_id)} />)}
          </div>
        </section>
      </main>
      {c.items.length > 0 && (
        <Link to="/cart" className="fixed bottom-[84px] left-4 right-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <span>ตะกร้า {cartCount(c)} รายการจาก {new Set(c.items.map((item) => item.shopId)).size} ร้าน</span>
          <span>฿{cartTotal(c)}</span>
        </Link>
      )}
      {showFilters && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 p-4" role="dialog" aria-modal="true" onClick={() => setShowFilters(false)}>
          <section className="mx-auto mt-auto max-w-md rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">ตัวกรอง</h2>
              <button type="button" onClick={() => setShowFilters(false)} className="text-2xl text-slate-400" aria-label="ปิด">×</button>
            </div>
            <label className="mt-5 flex items-center justify-between border-b border-slate-100 py-3 text-sm">
              <span>แสดงเฉพาะร้านที่เปิดอยู่</span>
              <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} className="h-5 w-5 accent-orange-500" />
            </label>
            <button type="button" onClick={() => setShowFilters(false)} className="mt-5 w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white">ดูผลลัพธ์</button>
          </section>
        </div>
      )}
    </div>
  );
}
