import { useEffect, useRef, useState } from "react";
import {
  DELIVERY_PLACE_SEARCH_MIN_LENGTH,
  searchDeliveryPlaces,
  type ConfirmedDeliveryPoint,
  type DeliveryPlaceSearchResult,
} from "@/lib/deliveryLocation";

type LatLngLiteral = { lat: number; lng: number };

type GoogleMap = {
  setCenter(position: LatLngLiteral): void;
  addListener(eventName: "click", handler: (event: { latLng?: { lat(): number; lng(): number } }) => void): { remove(): void };
};

type GoogleMarker = {
  setMap(map: GoogleMap | null): void;
  setPosition(position: LatLngLiteral): void;
  addListener(eventName: "dragend", handler: (event: { latLng?: { lat(): number; lng(): number } }) => void): { remove(): void };
};

type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: { center: LatLngLiteral; zoom: number; mapTypeControl: boolean; streetViewControl: boolean; fullscreenControl: boolean }) => GoogleMap;
    Marker: new (options: { map: GoogleMap; position: LatLngLiteral; draggable: boolean }) => GoogleMarker;
  };
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

export function DeliveryLocationPicker({ shopId, candidate, onCandidateChange, onSafeFormattedAddress }: Props) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const candidateRef = useRef<ConfirmedDeliveryPoint | null>(candidate);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<DeliveryPlaceSearchResult[]>([]);

  useEffect(() => {
    candidateRef.current = candidate;
  }, [candidate]);

  useEffect(() => {
    let disposed = false;
    void loadGoogleMaps()
      .then((google) => {
        if (disposed || !mapElementRef.current || mapRef.current) return;
        const map = new google.maps.Map(mapElementRef.current, {
          center: candidate ? { lat: candidate.lat, lng: candidate.lng } : DEFAULT_CENTER,
          zoom: candidate ? 17 : 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        map.addListener("click", (event) => {
          const latLng = event.latLng;
          if (!latLng) return;
          onCandidateChange(adjustedPoint(candidateRef.current, { lat: latLng.lat(), lng: latLng.lng() }));
        });
      })
      .catch(() => {
        if (!disposed) setMapsError("เปิดแผนที่ในแอปไม่ได้ตอนนี้ ยังใช้ GPS หรือ Google Maps link ได้");
      });
    return () => {
      disposed = true;
    };
  }, [candidate, onCandidateChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !candidate || !window.google) return;
    const position = { lat: candidate.lat, lng: candidate.lng };
    map.setCenter(position);
    if (!markerRef.current) {
      const marker = new window.google.maps.Marker({ map, position, draggable: true });
      marker.addListener("dragend", (event) => {
        const latLng = event.latLng;
        if (!latLng) return;
        onCandidateChange(adjustedPoint(candidateRef.current, { lat: latLng.lat(), lng: latLng.lng() }));
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setPosition(position);
    }
  }, [candidate, onCandidateChange]);

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
