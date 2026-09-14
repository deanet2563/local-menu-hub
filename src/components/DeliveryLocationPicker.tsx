import { useEffect, useRef, useState } from "react";
import {
  DELIVERY_PLACE_SEARCH_MIN_LENGTH,
  searchDeliveryPlaces,
  type ConfirmedDeliveryPoint,
  type DeliveryPlaceSearchResult,
} from "@/lib/deliveryLocation";
import {
  boundsForMerchantPoints,
  CHECKOUT_MAP_FIT_PADDING,
  CHECKOUT_MAP_SINGLE_POINT_ZOOM,
  merchantFallbackIcon,
  normalizeMerchantMapRows,
  type MerchantMapBoundsPadding,
  type MerchantMapRow,
  type MerchantMapShop,
  type MerchantMapViewport,
} from "@/lib/merchantMapMarkers";
import { publicSupabase } from "@/lib/supabase";

type LatLngLiteral = { lat: number; lng: number };

type GoogleMap = {
  setCenter(position: LatLngLiteral): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: MerchantMapViewport, padding: number | MerchantMapBoundsPadding): void;
  getBounds(): { getNorthEast(): { lat(): number; lng(): number }; getSouthWest(): { lat(): number; lng(): number } } | undefined;
  addListener(eventName: "click", handler: (event: { latLng?: { lat(): number; lng(): number } }) => void): { remove(): void };
  addListener(eventName: "idle", handler: () => void): { remove(): void };
};

type GoogleMarker = {
  setMap(map: GoogleMap | null): void;
  setPosition(position: LatLngLiteral): void;
  addListener(eventName: "click", handler: () => void): { remove(): void };
  addListener(eventName: "dragend", handler: (event: { latLng?: { lat(): number; lng(): number } }) => void): { remove(): void };
};

type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: { center: LatLngLiteral; zoom: number; mapTypeControl: boolean; streetViewControl: boolean; fullscreenControl: boolean }) => GoogleMap;
    Marker: new (options: { map: GoogleMap; position: LatLngLiteral; draggable?: boolean; title?: string; zIndex?: number; label?: string | { text: string; color?: string; fontSize?: string; fontWeight?: string }; icon?: GoogleMarkerIcon }) => GoogleMarker;
    Size?: new (width: number, height: number) => unknown;
    Point?: new (x: number, y: number) => unknown;
  };
};

type GoogleMarkerIcon = {
  url: string;
  scaledSize: unknown;
  anchor: unknown;
};

type MarkerHandle = {
  listeners: Array<{ remove(): void }>;
  clear(): void;
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

type Props = {
  shopId: string | null;
  candidate: ConfirmedDeliveryPoint | null;
  onCandidateChange: (point: ConfirmedDeliveryPoint) => void;
  onSafeFormattedAddress?: (formattedAddress: string) => void;
  debug?: boolean;
};

const DEFAULT_CENTER = { lat: 13.777, lng: 100.674 };
let mapsLoadPromise: Promise<GoogleMapsApi> | null = null;

function getMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? "";
}

function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (window.google) return Promise.resolve(window.google);
  if (mapsLoadPromise) return mapsLoadPromise;

  const key = getMapsApiKey();
  if (!key) return Promise.reject(new Error("maps_key_missing"));

  mapsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-mytree-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => window.google ? resolve(window.google) : reject(new Error("maps_load_failed")), { once: true });
      existing.addEventListener("error", () => reject(new Error("maps_load_failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.mytreeGoogleMaps = "true";
    script.addEventListener("load", () => window.google ? resolve(window.google) : reject(new Error("maps_load_failed")), { once: true });
    script.addEventListener("error", () => reject(new Error("maps_load_failed")), { once: true });
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

function pointFromResult(result: DeliveryPlaceSearchResult): ConfirmedDeliveryPoint {
  return {
    lat: result.lat,
    lng: result.lng,
    accuracy: null,
    source: "map_pin",
    submittedValue: null,
    resolvedUrl: null,
    placeId: result.placeId,
    displayName: result.displayName,
    formattedAddress: result.formattedAddress,
    resolutionMethod: "places_text_search",
  };
}

function adjustedPoint(current: ConfirmedDeliveryPoint | null, position: LatLngLiteral): ConfirmedDeliveryPoint {
  return {
    lat: position.lat,
    lng: position.lng,
    accuracy: null,
    source: "map_pin",
    submittedValue: current?.submittedValue ?? null,
    resolvedUrl: current?.resolvedUrl ?? null,
    placeId: current?.placeId ?? null,
    displayName: current?.displayName ?? null,
    formattedAddress: current?.formattedAddress ?? null,
    resolutionMethod: current?.resolutionMethod ?? null,
  };
}

function merchantStatusLabel(shop: MerchantMapShop): string | null {
  if (shop.isOpen === true) return "เปิดอยู่";
  if (shop.isOpen === false) return "ปิดอยู่";
  return null;
}

function legacyMerchantMarkerIcon(): { url: string; scaledSize: unknown; anchor: unknown } | undefined {
  if (!window.google?.maps?.Size || !window.google?.maps?.Point) return undefined;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">',
    '<path d="M22 51 14 39h16l-8 12Z" fill="#9a3412"/>',
    '<circle cx="22" cy="21" r="18" fill="#ffedd5" stroke="#9a3412" stroke-width="4"/>',
    '<text x="22" y="27" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="800" fill="#9a3412">M</text>',
    "</svg>",
  ].join("");
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(44, 52),
    anchor: new window.google.maps.Point(22, 52),
  };
}

export function DeliveryLocationPicker({ shopId, candidate, onCandidateChange, onSafeFormattedAddress }: Props) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const mapListenersRef = useRef<Array<{ remove(): void }>>([]);
  const markerListenersRef = useRef<Array<{ remove(): void }>>([]);
  const cartShopMarkerRef = useRef<MarkerHandle | null>(null);
  const cartShopRequestSeqRef = useRef(0);
  const initialFitDoneRef = useRef(false);
  const candidateRef = useRef<ConfirmedDeliveryPoint | null>(candidate);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [cartShop, setCartShop] = useState<MerchantMapShop | null>(null);
  const [cartShopStatus, setCartShopStatus] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantMapShop | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<DeliveryPlaceSearchResult[]>([]);

  useEffect(() => {
    candidateRef.current = candidate;
  }, [candidate]);

  function clearCartShopMarker() {
    if (!cartShopMarkerRef.current) return;
    cartShopMarkerRef.current.listeners.forEach((listener) => listener.remove());
    cartShopMarkerRef.current.clear();
    cartShopMarkerRef.current = null;
  }

  useEffect(() => {
    let disposed = false;
    void loadGoogleMaps()
      .then((google) => {
        if (disposed || !mapElementRef.current || mapRef.current) return;
        const initialCandidate = candidateRef.current;
        const map = new google.maps.Map(mapElementRef.current, {
          center: initialCandidate
            ? { lat: initialCandidate.lat, lng: initialCandidate.lng }
            : cartShop
              ? { lat: cartShop.lat, lng: cartShop.lng }
              : DEFAULT_CENTER,
          zoom: initialCandidate ? 17 : cartShop ? CHECKOUT_MAP_SINGLE_POINT_ZOOM : 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        setMapReady(true);
        const clickListener = map.addListener("click", (event) => {
          const latLng = event.latLng;
          if (!latLng) return;
          setSelectedMerchant(null);
          onCandidateChange(adjustedPoint(candidateRef.current, { lat: latLng.lat(), lng: latLng.lng() }));
        });
        mapListenersRef.current = [clickListener];
      })
      .catch(() => {
        if (!disposed) setMapsError("เปิดแผนที่ในแอปไม่ได้ตอนนี้ ยังใช้ GPS หรือ Google Maps link ได้");
      });
    return () => {
      disposed = true;
      cartShopRequestSeqRef.current += 1;
      mapListenersRef.current.forEach((listener) => listener.remove());
      mapListenersRef.current = [];
      markerListenersRef.current.forEach((listener) => listener.remove());
      markerListenersRef.current = [];
      clearCartShopMarker();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
  }, [onCandidateChange]);

  useEffect(() => {
    if (!shopId) {
      cartShopRequestSeqRef.current += 1;
      setCartShop(null);
      setCartShopStatus("ยังไม่มีร้านค้าในตะกร้า");
      return;
    }

    const requestSeq = cartShopRequestSeqRef.current + 1;
    cartShopRequestSeqRef.current = requestSeq;
    setCartShopStatus(null);
    publicSupabase
      .from("shops")
      .select("shop_id,name,category,description,address,logo_url,is_open,lat,lng")
      .eq("shop_id", shopId)
      .eq("is_approved", true)
      .eq("is_banned", false)
      .maybeSingle()
      .then(({ data, error }) => {
        if (requestSeq !== cartShopRequestSeqRef.current) return;
        if (error) {
          setCartShop(null);
          setCartShopStatus("โหลดพิกัดร้านค้าในตะกร้าไม่สำเร็จ");
          return;
        }
        const [shop] = normalizeMerchantMapRows(data ? [data as MerchantMapRow] : []);
        setCartShop(shop ?? null);
        setCartShopStatus(shop ? null : "ร้านค้าในตะกร้ายังไม่มีพิกัดสำหรับแสดงบนแผนที่");
      });

    return () => {
      cartShopRequestSeqRef.current += 1;
    };
  }, [shopId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !cartShop || !window.google) {
      clearCartShopMarker();
      return;
    }

    clearCartShopMarker();
    setCartShopStatus(null);
    const marker = new window.google.maps.Marker({
      map,
      position: { lat: cartShop.lat, lng: cartShop.lng },
      title: cartShop.name,
      zIndex: 20_000,
      icon: legacyMerchantMarkerIcon(),
    });
    const listeners = [marker.addListener("click", () => setSelectedMerchant(cartShop))];
    cartShopMarkerRef.current = { listeners, clear: () => marker.setMap(null) };

    return clearCartShopMarker;
  }, [cartShop, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !cartShop || initialFitDoneRef.current) return;
    const currentCandidate = candidateRef.current;
    if (currentCandidate) {
      const bounds = boundsForMerchantPoints([
        { lat: cartShop.lat, lng: cartShop.lng },
        { lat: currentCandidate.lat, lng: currentCandidate.lng },
      ]);
      if (!bounds) return;
      initialFitDoneRef.current = true;
      map.fitBounds(bounds, CHECKOUT_MAP_FIT_PADDING);
      return;
    }
    initialFitDoneRef.current = true;
    map.setCenter({ lat: cartShop.lat, lng: cartShop.lng });
    map.setZoom(CHECKOUT_MAP_SINGLE_POINT_ZOOM);
  }, [cartShop, candidate, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !candidate || !window.google) return;
    const position = { lat: candidate.lat, lng: candidate.lng };
    map.setCenter(position);
    if (!markerRef.current) {
      const marker = new window.google.maps.Marker({ map, position, draggable: true });
      const dragListener = marker.addListener("dragend", (event) => {
        const latLng = event.latLng;
        if (!latLng) return;
        onCandidateChange(adjustedPoint(candidateRef.current, { lat: latLng.lat(), lng: latLng.lng() }));
      });
      markerListenersRef.current = [dragListener];
      markerRef.current = marker;
    } else {
      markerRef.current.setPosition(position);
    }
  }, [candidate, mapReady, onCandidateChange]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < DELIVERY_PLACE_SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchDeliveryPlaces(trimmed, shopId, controller.signal)
        .then((nextResults) => setResults(nextResults))
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setSearchError(cause instanceof Error ? cause.message : "ค้นหาสถานที่ไม่สำเร็จ");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, shopId]);

  function selectResult(result: DeliveryPlaceSearchResult) {
    const point = pointFromResult(result);
    onCandidateChange(point);
    onSafeFormattedAddress?.(result.formattedAddress);
    setResults([]);
    setQuery(result.displayName);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="delivery-place-search" className="text-xs font-medium text-gray-600">ค้นหาสถานที่ อาคาร หมู่บ้าน ร้านค้า</label>
        <input
          id="delivery-place-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="บ้านส้มตำ กรุงเทพกรีฑา, Sammakorn, The Paseo"
          className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
        />
        <p className="text-[11px] leading-4 text-gray-500">เลือกสถานที่ก่อน แล้วเลื่อนหมุดไปที่ประตู ทางเข้า ล็อบบี้ หรือจุดรับสินค้าจริงได้</p>
      </div>

      {(searching || searchError || results.length > 0) && (
        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
          {searching && <p className="p-3 text-xs text-gray-500">กำลังค้นหา...</p>}
          {searchError && <p className="p-3 text-xs text-amber-700">{searchError}</p>}
          {results.map((result) => (
            <button
              type="button"
              key={result.placeId}
              onClick={() => selectResult(result)}
              className="block w-full border-t border-gray-100 p-3 text-left first:border-t-0"
            >
              <span className="block text-sm font-semibold text-gray-800">{result.displayName}</span>
              <span className="mt-0.5 block text-xs leading-4 text-gray-500">{result.formattedAddress}</span>
            </button>
          ))}
        </div>
      )}

      {mapsError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{mapsError}</div>
      ) : (
        <div className="relative h-[320px] min-h-[320px] overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          <div ref={mapElementRef} className="h-full w-full" />
          <style>{`
            .mytree-merchant-marker {
              position: relative;
              display: grid;
              width: 44px;
              height: 52px;
              place-items: start center;
              overflow: visible;
              cursor: pointer;
            }
            .mytree-merchant-marker-visual {
              display: grid;
              width: 40px;
              height: 40px;
              place-items: center;
              overflow: hidden;
              border: 2px solid #14532d;
              border-radius: 999px;
              background: #dcfce7;
              box-shadow: 0 8px 20px rgba(20, 83, 45, 0.28);
              color: #052e16;
              font-size: 17px;
              font-weight: 800;
              line-height: 1;
            }
            .mytree-merchant-marker-logo {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .mytree-merchant-marker-fallback {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .mytree-merchant-marker::after {
              position: absolute;
              left: 50%;
              bottom: 7px;
              width: 10px;
              height: 10px;
              border-right: 2px solid #14532d;
              border-bottom: 2px solid #14532d;
              background: #dcfce7;
              content: "";
              transform: translateX(-50%) rotate(45deg);
            }
            .mytree-cart-shop-marker .mytree-merchant-marker-visual {
              border-color: #9a3412;
              background: #ffedd5;
              box-shadow: 0 10px 24px rgba(154, 52, 18, 0.34);
              color: #9a3412;
            }
            .mytree-cart-shop-marker::after {
              border-color: #9a3412;
              background: #ffedd5;
            }
          `}</style>
          {cartShopStatus && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-white/95 p-2 text-xs leading-4 text-gray-600 shadow-sm">
              {cartShopStatus}
            </div>
          )}
          {selectedMerchant && (
            <div className="absolute inset-x-3 bottom-3 max-h-[45%] overflow-auto rounded-lg border border-green-200 bg-white p-3 text-left shadow-lg">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-green-700 bg-green-50 text-sm font-black text-green-900">
                  {selectedMerchant.logoUrl ? (
                    <img src={selectedMerchant.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true">{merchantFallbackIcon(selectedMerchant.category)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-5 text-gray-900">{selectedMerchant.name}</p>
                  {(selectedMerchant.category || selectedMerchant.description) && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-gray-600">{selectedMerchant.category || selectedMerchant.description}</p>
                  )}
                  {merchantStatusLabel(selectedMerchant) && (
                    <p className={`mt-1 text-[11px] font-semibold ${selectedMerchant.isOpen ? "text-green-700" : "text-gray-500"}`}>
                      {merchantStatusLabel(selectedMerchant)}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={`/shop/${encodeURIComponent(selectedMerchant.shopId)}`} className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-semibold text-white">
                  ดูร้านค้า
                </a>
                <button type="button" onClick={() => setSelectedMerchant(null)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600">
                  ปิด
                </button>
              </div>
            </div>
          )}
          {!candidate && (
            <div className="pointer-events-none absolute inset-x-3 top-3 rounded-lg bg-white/95 p-2 text-xs leading-4 text-gray-600 shadow-sm">
              ค้นหาแล้วเลือกผลลัพธ์ หรือแตะแผนที่เพื่อวางหมุด
            </div>
          )}
        </div>
      )}

      {candidate && (
        <div className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs leading-5 text-gray-700">
          {candidate.displayName && <p className="font-semibold text-gray-900">{candidate.displayName}</p>}
          {candidate.formattedAddress && <p>{candidate.formattedAddress}</p>}
          <p className="font-mono">พิกัดหมุด Rider: {candidate.lat.toFixed(6)}, {candidate.lng.toFixed(6)}</p>
          {candidate.placeId && <p className="text-gray-500">Place ID: {candidate.placeId}</p>}
        </div>
      )}
    </div>
  );
}
