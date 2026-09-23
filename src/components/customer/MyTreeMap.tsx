import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MERCHANT_MARKER_QUERY_LIMIT,
  merchantFallbackIcon,
  normalizeMerchantMapRows,
  type MerchantMapRow,
  type MerchantMapShop,
} from "@/lib/merchantMapMarkers";
import { directionsUrl, distanceKm, filterMapShops, formatDistance, type MapLocation } from "@/lib/myTreeMap";
import { publicSupabase } from "@/lib/publicSupabase";

type LatLngLiteral = { lat: number; lng: number };
type Listener = { remove(): void };
type MyTreeGoogleMap = {
  fitBounds(bounds: { extend(point: LatLngLiteral): void }, padding: number): void;
  panTo(position: LatLngLiteral): void;
  setZoom(zoom: number): void;
};
type MyTreeGoogleMarker = {
  setMap(map: MyTreeGoogleMap | null): void;
  addListener(eventName: "click", handler: () => void): Listener;
};
type MyTreeGoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => MyTreeGoogleMap;
    Marker: new (options: Record<string, unknown>) => MyTreeGoogleMarker;
    LatLngBounds: new () => { extend(point: LatLngLiteral): void };
    Size?: new (width: number, height: number) => unknown;
    Point?: new (x: number, y: number) => unknown;
  };
};

const SAMMAKORN_CENTER = { lat: 13.777, lng: 100.674 };
let mapsPromise: Promise<MyTreeGoogleMapsApi> | null = null;

function currentMaps(): MyTreeGoogleMapsApi | undefined {
  return (window as unknown as { google?: MyTreeGoogleMapsApi }).google;
}

function loadMaps(): Promise<MyTreeGoogleMapsApi> {
  const ready = currentMaps();
  if (ready) return Promise.resolve(ready);
  if (mapsPromise) return mapsPromise;
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) return Promise.reject(new Error("maps_key_missing"));
  const attempt = new Promise<MyTreeGoogleMapsApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-mytree-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => currentMaps() ? resolve(currentMaps()!) : reject(new Error("maps_load_failed")), { once: true });
      existing.addEventListener("error", () => reject(new Error("maps_load_failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.mytreeGoogleMaps = "true";
    script.addEventListener("load", () => currentMaps() ? resolve(currentMaps()!) : reject(new Error("maps_load_failed")), { once: true });
    script.addEventListener("error", () => reject(new Error("maps_load_failed")), { once: true });
    document.head.appendChild(script);
  }).catch((error): never => {
    mapsPromise = null;
    if (!currentMaps()) document.querySelector<HTMLScriptElement>("script[data-mytree-google-maps]")?.remove();
    throw error;
  });
  mapsPromise = attempt;
  return attempt;
}

function markerIcon(shop: MerchantMapShop): Record<string, unknown> | undefined {
  const google = currentMaps();
  if (!google?.maps.Size || !google.maps.Point) return undefined;
  const fill = shop.isOpen === false ? "#f3f4f6" : "#fff7ed";
  const stroke = shop.isOpen === false ? "#6b7280" : "#ea580c";
  const glyph = merchantFallbackIcon(shop.category);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56"><path d="M24 55 16 42h16L24 55Z" fill="${stroke}"/><circle cx="24" cy="22" r="20" fill="${fill}" stroke="${stroke}" stroke-width="4"/><text x="24" y="29" text-anchor="middle" font-family="Arial,sans-serif" font-size="18">${glyph}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(48, 56),
    anchor: new google.maps.Point(24, 56),
  };
}

function ShopCard({ shop, location, compact = false, onShowOnMap }: { shop: MerchantMapShop; location: MapLocation | null; compact?: boolean; onShowOnMap?: () => void }) {
  const distance = location ? formatDistance(distanceKm(location, shop)) : null;
  return (
    <article className={`rounded-2xl border border-[#dce8dc] bg-white shadow-[0_12px_32px_rgba(31,82,55,0.12)] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#eef7e9] text-xl">
          {shop.logoUrl ? <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">{merchantFallbackIcon(shop.category)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate text-base font-bold text-[#173c29]">{shop.name}</h2>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${shop.isOpen === true ? "bg-green-50 text-green-700" : shop.isOpen === false ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"}`}>
              {shop.isOpen === true ? "เปิดอยู่" : shop.isOpen === false ? "ปิดอยู่" : "ตรวจสอบเวลา"}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-gray-500">{[shop.category, distance].filter(Boolean).join(" · ") || "ร้านค้าใน MyTree"}</p>
          {shop.address && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{shop.address}</p>}
        </div>
      </div>
      <div className={`mt-3 grid gap-2 ${onShowOnMap ? "grid-cols-3" : "grid-cols-2"}`}>
        {onShowOnMap && <button type="button" onClick={onShowOnMap} className="rounded-xl border border-[#b9d2bd] bg-[#eef7e9] px-2 py-2.5 text-center text-xs font-semibold text-[#1f6a45]">ดูบนแผนที่</button>}
        <Link to="/shop/$shopId" params={{ shopId: shop.shopId }} className="rounded-xl bg-[#1f6a45] px-2 py-2.5 text-center text-xs font-semibold text-white">ดูร้านและสั่ง</Link>
        <a href={directionsUrl(shop)} target="_blank" rel="noreferrer" className="rounded-xl border border-[#f2a35e] bg-[#fff7ed] px-2 py-2.5 text-center text-xs font-semibold text-[#a9470b]">เปิดนำทาง</a>
      </div>
    </article>
  );
}

export function MyTreeMap() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MyTreeGoogleMap | null>(null);
  const markerHandlesRef = useRef<Array<{ marker: MyTreeGoogleMarker; listener: Listener }>>([]);
  const locationMarkerRef = useRef<MyTreeGoogleMarker | null>(null);
  const [shops, setShops] = useState<MerchantMapShop[]>([]);
  const [selectedShop, setSelectedShop] = useState<MerchantMapShop | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const [mapsAttempt, setMapsAttempt] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [location, setLocation] = useState<MapLocation | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "denied" | "error" | "ready">("idle");

  async function loadShops() {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await publicSupabase
      .from("shops")
      .select("shop_id,name,category,description,address,logo_url,is_open,lat,lng")
      .eq("is_approved", true)
      .eq("is_banned", false)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .limit(MERCHANT_MARKER_QUERY_LIMIT);
    if (error) setLoadError(true);
    else setShops(normalizeMerchantMapRows((data ?? []) as MerchantMapRow[]));
    setLoading(false);
  }

  useEffect(() => { void loadShops(); }, []);

  useEffect(() => {
    let disposed = false;
    setMapsError(false);
    void loadMaps().then((google) => {
      if (disposed || !mapElementRef.current || mapRef.current) return;
      mapRef.current = new google.maps.Map(mapElementRef.current, {
        center: SAMMAKORN_CENTER,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        ...(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ? { mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID } : {}),
      });
      setMapReady(true);
    }).catch(() => { if (!disposed) setMapsError(true); });
    return () => {
      disposed = true;
      markerHandlesRef.current.forEach(({ marker, listener }) => { listener.remove(); marker.setMap(null); });
      markerHandlesRef.current = [];
      locationMarkerRef.current?.setMap(null);
      locationMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [mapsAttempt]);

  const categories = useMemo(() => Array.from(new Set(shops.map((shop) => shop.category).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "th")), [shops]);
  const filteredShops = useMemo(() => {
    const filtered = filterMapShops(shops, query, category, openOnly);
    if (!location) return filtered;
    return [...filtered].sort((a, b) => distanceKm(location, a) - distanceKm(location, b));
  }, [category, location, openOnly, query, shops]);

  useEffect(() => {
    if (selectedShop && !filteredShops.some((shop) => shop.shopId === selectedShop.shopId)) {
      setSelectedShop(null);
    }
  }, [filteredShops, selectedShop]);

  useEffect(() => {
    const map = mapRef.current;
    const google = currentMaps();
    if (!mapReady || !map || !google) return;
    markerHandlesRef.current.forEach(({ marker, listener }) => { listener.remove(); marker.setMap(null); });
    markerHandlesRef.current = filteredShops.map((shop) => {
      const marker = new google.maps.Marker({ map, position: { lat: shop.lat, lng: shop.lng }, title: shop.name, icon: markerIcon(shop) });
      const listener = marker.addListener("click", () => setSelectedShop(shop));
      return { marker, listener };
    });
    if (filteredShops.length === 1 && !location) {
      map.panTo({ lat: filteredShops[0]!.lat, lng: filteredShops[0]!.lng });
      map.setZoom(15);
    } else if (filteredShops.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      filteredShops.forEach((shop) => bounds.extend({ lat: shop.lat, lng: shop.lng }));
      if (location) bounds.extend(location);
      map.fitBounds(bounds, 56);
    }
  }, [filteredShops, location, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const google = currentMaps();
    if (!mapReady || !map || !google || !location) return;
    locationMarkerRef.current?.setMap(null);
    locationMarkerRef.current = new google.maps.Marker({ map, position: location, title: "ตำแหน่งของฉัน", zIndex: 30_000 });
  }, [location, mapReady]);

  function locateMe() {
    if (!navigator.geolocation) return setLocationState("error");
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation(point);
      setLocationState("ready");
      const map = mapRef.current;
      const google = currentMaps();
      if (!map || !google) return;
      locationMarkerRef.current?.setMap(null);
      locationMarkerRef.current = new google.maps.Marker({ map, position: point, title: "ตำแหน่งของฉัน", zIndex: 30_000 });
      map.panTo(point);
      map.setZoom(15);
    }, (error) => setLocationState(error.code === 1 ? "denied" : "error"), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
  }

  function chooseShop(shop: MerchantMapShop) {
    setSelectedShop(shop);
    setView("map");
    mapRef.current?.panTo({ lat: shop.lat, lng: shop.lng });
    mapRef.current?.setZoom(17);
  }

  return (
    <main className="min-h-dvh bg-[#f8fbf5] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] text-[#173c29]">
      <header className="border-b border-[#dce8dc] bg-white px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8661d]">MyTree Local Map</p>
            <h1 className="text-xl font-black">ร้านอาหารใกล้บ้าน</h1>
          </div>
          <Link to="/" className="rounded-full border border-[#dce8dc] bg-[#f8fbf5] px-3 py-2 text-sm font-semibold">หน้าแรก</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl p-4">
        <div className="rounded-3xl border border-[#dce8dc] bg-white p-3 shadow-[0_14px_40px_rgba(31,82,55,0.09)]">
          <label htmlFor="map-shop-search" className="sr-only">ค้นหาร้าน ประเภทอาหาร หรือที่อยู่</label>
          <div className="flex gap-2">
            <input id="map-shop-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาร้าน อาหาร หรือซอย" className="min-w-0 flex-1 rounded-2xl border border-[#dce8dc] bg-[#f8fbf5] px-4 py-3 text-sm outline-none focus:border-[#1f6a45]" />
            <button type="button" onClick={locateMe} disabled={locationState === "loading"} className="shrink-0 rounded-2xl bg-[#fff1e5] px-3 py-3 text-sm font-bold text-[#b64d0c] disabled:opacity-60">{locationState === "loading" ? "กำลังหา…" : "ตำแหน่งฉัน"}</button>
          </div>
          {(locationState === "denied" || locationState === "error") && <p className="mt-2 text-xs text-amber-700">{locationState === "denied" ? "ไม่ได้รับสิทธิ์ตำแหน่ง — ยังค้นหาและดูร้านบนแผนที่ได้ตามปกติ" : "อ่านตำแหน่งไม่สำเร็จ กรุณาลองอีกครั้ง"}</p>}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setCategory(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${category === null ? "bg-[#1f6a45] text-white" : "bg-[#eef7e9] text-[#315a42]"}`}>ทั้งหมด</button>
            {categories.map((value) => <button type="button" key={value} onClick={() => setCategory(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${category === value ? "bg-[#1f6a45] text-white" : "bg-[#eef7e9] text-[#315a42]"}`}>{value}</button>)}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#315a42]"><input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} className="h-4 w-4 accent-[#1f6a45]" /> เปิดอยู่ตอนนี้</label>
            <div className="rounded-full bg-[#eef7e9] p-1">
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === "map" ? "bg-white text-[#1f6a45] shadow-sm" : "text-[#668170]"}`}>แผนที่</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === "list" ? "bg-white text-[#1f6a45] shadow-sm" : "text-[#668170]"}`}>รายการ</button>
            </div>
          </div>
        </div>

        {loadError && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>โหลดร้านค้าบนแผนที่ไม่สำเร็จ</p><button type="button" onClick={() => void loadShops()} className="mt-2 font-bold underline">ลองอีกครั้ง</button></div>}

        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4">
          <div className={view === "list" ? "hidden lg:block" : "relative h-[calc(100dvh-350px)] min-h-[430px] overflow-hidden rounded-3xl border border-[#dce8dc] bg-[#eef3ec] lg:h-[calc(100dvh-280px)]"}>
            <div ref={mapElementRef} className="h-full w-full" />
            {mapsError && <div className="absolute inset-0 grid place-items-center bg-[#f8fbf5] p-8 text-center"><div><p className="font-bold">เปิดแผนที่ไม่ได้ในขณะนี้</p><p className="mt-1 text-sm text-gray-600">ยังสามารถดูร้านแบบรายการและเปิดนำทางได้</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={() => setMapsAttempt((attempt) => attempt + 1)} className="rounded-xl border border-[#b9d2bd] bg-white px-4 py-2 text-sm font-semibold text-[#1f6a45]">ลองโหลดใหม่</button><button type="button" onClick={() => setView("list")} className="rounded-xl bg-[#1f6a45] px-4 py-2 text-sm font-semibold text-white">ดูแบบรายการ</button></div></div></div>}
            {loading && <div className="absolute inset-x-4 top-4 rounded-2xl bg-white/95 p-3 text-sm shadow">กำลังโหลดร้านค้าใกล้บ้าน…</div>}
            {!loading && !loadError && filteredShops.length === 0 && <div className="absolute inset-x-4 top-4 rounded-2xl bg-white/95 p-4 text-center text-sm shadow">ไม่พบร้านตามตัวกรองนี้ ลองเลือก “ทั้งหมด” หรือปิดตัวกรอง “เปิดอยู่ตอนนี้”</div>}
            {selectedShop && <div className="absolute inset-x-3 bottom-3 z-10"><ShopCard shop={selectedShop} location={location} compact /></div>}
          </div>

          <aside className={`${view === "map" ? "hidden lg:block" : "block"} space-y-3 ${view === "list" ? "mt-4 lg:mt-0" : ""}`}>
            <div className="flex items-center justify-between px-1"><p className="text-sm font-bold">พบ {filteredShops.length} ร้าน</p>{location && <p className="text-xs text-green-700">เรียงจากใกล้ที่สุด</p>}</div>
            {loading && Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-[#e9f0e7]" />)}
            {!loading && filteredShops.map((shop) => <ShopCard key={shop.shopId} shop={shop} location={location} onShowOnMap={() => chooseShop(shop)} />)}
          </aside>
        </div>
      </section>
    </main>
  );
}
