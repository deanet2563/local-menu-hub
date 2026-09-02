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
  MERCHANT_MARKER_QUERY_LIMIT,
  normalizeMerchantMapRows,
  paddedMerchantViewport,
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
    Map: new (element: HTMLElement, options: { center: LatLngLiteral; zoom: number; mapTypeControl: boolean; streetViewControl: boolean; fullscreenControl: boolean; mapId?: string }) => GoogleMap;
    Marker: new (options: { map: GoogleMap; position: LatLngLiteral; draggable?: boolean; title?: string; zIndex?: number; label?: string | { text: string; color?: string; fontSize?: string; fontWeight?: string } }) => GoogleMarker;
    importLibrary?: (name: string) => Promise<unknown>;
    marker?: {
      AdvancedMarkerElement: new (options: { map: GoogleMap; position: LatLngLiteral; title: string; content: HTMLElement; zIndex: number }) => GoogleAdvancedMarker;
    };
  };
};

type GoogleAdvancedMarker = {
  map: GoogleMap | null;
  addListener(eventName: "click", handler: () => void): { remove(): void };
};

type GoogleMarkerLibrary = {
  AdvancedMarkerElement: new (options: { map: GoogleMap; position: LatLngLiteral; title: string; content: HTMLElement; zIndex: number }) => GoogleAdvancedMarker;
};

type MarkerHandle = {
  listeners: Array<{ remove(): void }>;
  clear(): void;
};

type MerchantMarkerKind = "cart-shop" | "viewport";
type CartShopQueryState = "waiting_for_shop_id" | "loading" | "loaded" | "not_found_or_no_coordinates" | "error";
type MarkerLibraryState = "not_requested" | "loading" | "loaded" | "unavailable";

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
let markerLibraryLoadPromise: Promise<GoogleMarkerLibrary | null> | null = null;

function getMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? "";
}

function getMapsMapId(): string | null {
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
  return mapId ? String(mapId) : null;
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.dataset.mytreeGoogleMaps = "true";
    script.addEventListener("load", () => window.google ? resolve(window.google) : reject(new Error("maps_load_failed")), { once: true });
    script.addEventListener("error", () => reject(new Error("maps_load_failed")), { once: true });
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

async function loadGoogleMarkerLibrary(google: GoogleMapsApi): Promise<GoogleMarkerLibrary | null> {
  const existing = google.maps.marker?.AdvancedMarkerElement;
  if (existing) return { AdvancedMarkerElement: existing };
  if (!google.maps.importLibrary) return null;
  markerLibraryLoadPromise ??= google.maps.importLibrary("marker")
    .then((library) => {
      const markerLibrary = library as Partial<GoogleMarkerLibrary>;
      return markerLibrary.AdvancedMarkerElement ? { AdvancedMarkerElement: markerLibrary.AdvancedMarkerElement } : null;
    })
    .catch(() => null);
  return markerLibraryLoadPromise;
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

function viewportFromMap(map: GoogleMap): MerchantMapViewport | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  return {
    north: northEast.lat(),
    south: southWest.lat(),
    east: northEast.lng(),
    west: southWest.lng(),
  };
}

function markerContent(shop: MerchantMapShop, kind: MerchantMarkerKind): HTMLElement {
  const wrapper = document.createElement("button");
  wrapper.type = "button";
  wrapper.className = kind === "cart-shop" ? "mytree-merchant-marker mytree-cart-shop-marker" : "mytree-merchant-marker";
  wrapper.textContent = shop.name;
  wrapper.setAttribute("aria-label", `ดูร้าน ${shop.name}`);
  return wrapper;
}

export function DeliveryLocationPicker({ shopId, candidate, onCandidateChange, onSafeFormattedAddress, debug = false }: Props) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const advancedMarkerRef = useRef<GoogleMarkerLibrary["AdvancedMarkerElement"] | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const mapListenersRef = useRef<Array<{ remove(): void }>>([]);
  const markerListenersRef = useRef<Array<{ remove(): void }>>([]);
  const merchantMarkersRef = useRef<MarkerHandle[]>([]);
  const cartShopMarkerRef = useRef<MarkerHandle | null>(null);
  const merchantRequestSeqRef = useRef(0);
  const cartShopRequestSeqRef = useRef(0);
  const initialFitDoneRef = useRef(false);
  const candidateRef = useRef<ConfirmedDeliveryPoint | null>(candidate);
  const [debugEnabled] = useState(() => debug || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mapDebug") === "1"));
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [markerLibraryState, setMarkerLibraryState] = useState<MarkerLibraryState>("not_requested");
  const [advancedMarkerAvailable, setAdvancedMarkerAvailable] = useState(false);
  const [legacyFallbackUsed, setLegacyFallbackUsed] = useState(false);
  const [cartShopMarkerCreated, setCartShopMarkerCreated] = useState(false);
  const [initialFitExecuted, setInitialFitExecuted] = useState(false);
  const [mapConfigStatus, setMapConfigStatus] = useState<string | null>(null);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  const [merchantShops, setMerchantShops] = useState<MerchantMapShop[]>([]);
  const [cartShop, setCartShop] = useState<MerchantMapShop | null>(null);
  const [cartShopQueryState, setCartShopQueryState] = useState<CartShopQueryState>("waiting_for_shop_id");
  const [cartShopStatus, setCartShopStatus] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantMapShop | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<DeliveryPlaceSearchResult[]>([]);

  useEffect(() => {
    candidateRef.current = candidate;
  }, [candidate]);

  function clearMerchantMarkers() {
    merchantMarkersRef.current.forEach(({ listeners, clear }) => {
      listeners.forEach((listener) => listener.remove());
      clear();
    });
    merchantMarkersRef.current = [];
  }

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
        const mapId = getMapsMapId();
        setMapConfigStatus(mapId ? null : "ยังไม่ได้ตั้งค่า Google Maps Map ID สำหรับหมุดร้านค้า MyTree");
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
          ...(mapId ? { mapId } : {}),
        });
        mapRef.current = map;
        setMapReady(true);
        const clickListener = map.addListener("click", (event) => {
          const latLng = event.latLng;
          if (!latLng) return;
          setSelectedMerchant(null);
          onCandidateChange(adjustedPoint(candidateRef.current, { lat: latLng.lat(), lng: latLng.lng() }));
        });
        const idleListener = map.addListener("idle", () => {
          const viewport = viewportFromMap(map);
          if (viewport) void loadMerchantShops(viewport);
        });
        mapListenersRef.current = [clickListener, idleListener];
        setMarkerLibraryState("loading");
        void loadGoogleMarkerLibrary(google).then((markerLibrary) => {
          if (disposed) return;
          advancedMarkerRef.current = markerLibrary?.AdvancedMarkerElement ?? null;
          setMarkerLibraryState(markerLibrary?.AdvancedMarkerElement ? "loaded" : "unavailable");
          setAdvancedMarkerAvailable(Boolean(markerLibrary?.AdvancedMarkerElement));
          if (!markerLibrary?.AdvancedMarkerElement) {
            setMerchantError("AdvancedMarkerElement ยังไม่พร้อม จะแสดงหมุดร้านค้าในตะกร้าด้วยหมุดสำรอง");
          }
        });
      })
      .catch(() => {
        if (!disposed) setMapsError("เปิดแผนที่ในแอปไม่ได้ตอนนี้ ยังใช้ GPS หรือ Google Maps link ได้");
      });
    return () => {
      disposed = true;
      merchantRequestSeqRef.current += 1;
      cartShopRequestSeqRef.current += 1;
      mapListenersRef.current.forEach((listener) => listener.remove());
      mapListenersRef.current = [];
      markerListenersRef.current.forEach((listener) => listener.remove());
      markerListenersRef.current = [];
      clearMerchantMarkers();
      clearCartShopMarker();
      mapRef.current = null;
      advancedMarkerRef.current = null;
      markerRef.current = null;
      setMapReady(false);
      setMarkerLibraryState("not_requested");
      setAdvancedMarkerAvailable(false);
      setLegacyFallbackUsed(false);
      setCartShopMarkerCreated(false);
    };
  }, [onCandidateChange]);

  useEffect(() => {
    if (!shopId) {
      cartShopRequestSeqRef.current += 1;
      setCartShop(null);
      setCartShopQueryState("waiting_for_shop_id");
      setCartShopStatus("ยังไม่มีร้านค้าในตะกร้า");
      return;
    }

    const requestSeq = cartShopRequestSeqRef.current + 1;
    cartShopRequestSeqRef.current = requestSeq;
    setCartShopQueryState("loading");
    setCartShopStatus(null);
    publicSupabase
      .from("shops")
      .select("shop_id,name,category,description,address,lat,lng")
      .eq("shop_id", shopId)
      .eq("is_approved", true)
      .eq("is_banned", false)
      .maybeSingle()
      .then(({ data, error }) => {
        if (requestSeq !== cartShopRequestSeqRef.current) return;
        if (error) {
          setCartShop(null);
          setCartShopQueryState("error");
          setCartShopStatus("โหลดพิกัดร้านค้าในตะกร้าไม่สำเร็จ");
          return;
        }
        const [shop] = normalizeMerchantMapRows(data ? [data as MerchantMapRow] : []);
        setCartShop(shop ?? null);
        setCartShopQueryState(shop ? "loaded" : "not_found_or_no_coordinates");
        setCartShopStatus(shop ? null : "ร้านค้าในตะกร้ายังไม่มีพิกัดสำหรับแสดงบนแผนที่");
      });

    return () => {
      cartShopRequestSeqRef.current += 1;
    };
  }, [shopId]);

  async function loadMerchantShops(viewport: MerchantMapViewport) {
    const requestSeq = merchantRequestSeqRef.current + 1;
    merchantRequestSeqRef.current = requestSeq;
    const padded = paddedMerchantViewport(viewport);
    setMerchantLoading(true);
    setMerchantError(null);
    const { data, error } = await publicSupabase
      .from("shops")
      .select("shop_id,name,category,description,address,lat,lng")
      .eq("is_approved", true)
      .eq("is_banned", false)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", padded.south)
      .lte("lat", padded.north)
      .gte("lng", padded.west)
      .lte("lng", padded.east)
      .limit(MERCHANT_MARKER_QUERY_LIMIT);

    if (requestSeq !== merchantRequestSeqRef.current) return;
    setMerchantLoading(false);
    if (error) {
      setMerchantError("โหลดหมุดร้านค้า MyTree ไม่สำเร็จ แต่ยังเลือกจุดส่งได้ตามปกติ");
      return;
    }
    setMerchantShops(normalizeMerchantMapRows((data ?? []) as MerchantMapRow[]));
  }

  useEffect(() => {
    const map = mapRef.current;
    const AdvancedMarkerElement = advancedMarkerRef.current;
    if (!map || !mapReady) return;
    if (!AdvancedMarkerElement) {
      if (merchantShops.length > 0) setMerchantError("AdvancedMarkerElement ยังไม่พร้อม จึงแสดงหมุดร้านค้า MyTree ไม่ได้");
      return;
    }

    clearMerchantMarkers();
    const excludedShopId = cartShop?.shopId ?? shopId;
    merchantMarkersRef.current = merchantShops.filter((shop) => shop.shopId !== excludedShopId).map((shop) => {
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: shop.lat, lng: shop.lng },
        title: shop.name,
        content: markerContent(shop, "viewport"),
        zIndex: 10_000,
      });
      const listeners = [marker.addListener("click", () => setSelectedMerchant(shop))];
      return { listeners, clear: () => { marker.map = null; } };
    });

    return clearMerchantMarkers;
  }, [advancedMarkerAvailable, cartShop?.shopId, mapReady, merchantShops, shopId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !cartShop || !window.google) {
      clearCartShopMarker();
      setLegacyFallbackUsed(false);
      setCartShopMarkerCreated(false);
      return;
    }

    clearCartShopMarker();
    const AdvancedMarkerElement = advancedMarkerRef.current;
    if (AdvancedMarkerElement) {
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: cartShop.lat, lng: cartShop.lng },
        title: cartShop.name,
        content: markerContent(cartShop, "cart-shop"),
        zIndex: 20_000,
      });
      const listeners = [marker.addListener("click", () => setSelectedMerchant(cartShop))];
      cartShopMarkerRef.current = { listeners, clear: () => { marker.map = null; } };
      setLegacyFallbackUsed(false);
      setCartShopMarkerCreated(true);
      return clearCartShopMarker;
    }

    setCartShopStatus(null);
    const marker = new window.google.maps.Marker({
      map,
      position: { lat: cartShop.lat, lng: cartShop.lng },
      title: cartShop.name,
      zIndex: 20_000,
      label: { text: cartShop.name, color: "#9a3412", fontSize: "12px", fontWeight: "700" },
    });
    const listeners = [marker.addListener("click", () => setSelectedMerchant(cartShop))];
    cartShopMarkerRef.current = { listeners, clear: () => marker.setMap(null) };
    setLegacyFallbackUsed(true);
    setCartShopMarkerCreated(true);

    return clearCartShopMarker;
  }, [advancedMarkerAvailable, cartShop, mapReady]);

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
      setInitialFitExecuted(true);
      map.fitBounds(bounds, CHECKOUT_MAP_FIT_PADDING);
      return;
    }
    initialFitDoneRef.current = true;
    setInitialFitExecuted(true);
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
              max-width: 112px;
              overflow: hidden;
              border: 2px solid #14532d;
              border-radius: 999px;
              background: #22c55e;
              box-shadow: 0 8px 20px rgba(20, 83, 45, 0.28);
              color: #052e16;
              cursor: pointer;
              font-size: 12px;
              font-weight: 800;
              line-height: 1;
              padding: 7px 10px;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .mytree-merchant-marker::after {
              position: absolute;
              left: 50%;
              bottom: -7px;
              width: 10px;
              height: 10px;
              border-right: 2px solid #14532d;
              border-bottom: 2px solid #14532d;
              background: #22c55e;
              content: "";
              transform: translateX(-50%) rotate(45deg);
            }
            .mytree-cart-shop-marker {
              border-color: #9a3412;
              background: #f97316;
              box-shadow: 0 10px 24px rgba(154, 52, 18, 0.34);
              color: #fff7ed;
            }
            .mytree-cart-shop-marker::after {
              border-color: #9a3412;
              background: #f97316;
            }
          `}</style>
          {debugEnabled && (
            <div className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-lg bg-gray-950/90 p-2 font-mono text-[10px] leading-4 text-white shadow-lg">
              <p>build: {import.meta.env.VITE_COMMIT_SHA || import.meta.env.VITE_BUILD_ID || "unknown"}</p>
              <p>shopId: {shopId || "missing"}</p>
              <p>cartShopQuery: {cartShopQueryState}</p>
              <p>cartShop: {cartShop ? `${cartShop.name} @ ${cartShop.lat.toFixed(6)},${cartShop.lng.toFixed(6)}` : "none"}</p>
              <p>mapId: {getMapsMapId() ? "yes" : "no"}</p>
              <p>markerLibrary: {markerLibraryState}</p>
              <p>advancedMarker: {advancedMarkerAvailable ? "yes" : "no"}</p>
              <p>legacyFallback: {legacyFallbackUsed ? "yes" : "no"}</p>
              <p>markerCreated: {cartShopMarkerCreated ? "yes" : "no"}</p>
              <p>mapInitialized: {mapReady ? "yes" : "no"}</p>
              <p>initialFit: {initialFitExecuted ? "yes" : "no"}</p>
            </div>
          )}
          {(merchantLoading || merchantError || cartShopStatus || mapConfigStatus) && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-white/95 p-2 text-xs leading-4 text-gray-600 shadow-sm">
              {mapConfigStatus ?? cartShopStatus ?? (merchantLoading ? "กำลังโหลดหมุดร้านค้า MyTree..." : merchantError)}
            </div>
          )}
          {selectedMerchant && (
            <div className="absolute inset-x-3 bottom-3 rounded-lg border border-green-200 bg-white p-3 text-left shadow-lg">
              <p className="text-sm font-bold leading-5 text-gray-900">{selectedMerchant.name}</p>
              {(selectedMerchant.category || selectedMerchant.description) && (
                <p className="mt-1 text-xs leading-4 text-gray-600">{selectedMerchant.category || selectedMerchant.description}</p>
              )}
              {selectedMerchant.category && selectedMerchant.description && (
                <p className="mt-0.5 text-xs leading-4 text-gray-500">{selectedMerchant.description}</p>
              )}
              <div className="mt-2 flex gap-2">
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
