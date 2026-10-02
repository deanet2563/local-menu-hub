import { useEffect, useRef, useState } from "react";
import {
  getGoogleMapsMapId,
  loadGoogleMaps,
  loadGoogleMarkerLibrary,
  type GoogleMap,
  type GoogleMarker,
  type GoogleMarkerLibrary,
} from "@/lib/googleMapsLoader";
import { hasValidLocalMapPin, type LocalMapLocation } from "@/lib/localMap";

const PILOT_CENTER = { lat: 13.777, lng: 100.674 };
type MarkerHandle = { listeners: Array<{ remove(): void }>; clear(): void };

/**
 * Provider adapter boundary: feature code passes MyTree-owned locations only.
 * Google-specific objects stay inside this renderer so the basemap can change
 * without changing the canonical MyTree location contract.
 */
export function LocalMapCanvas({
  locations,
  selectedId,
  onSelect,
  onCloseSelection,
  heightClass = "h-[520px]",
}: {
  locations: LocalMapLocation[];
  selectedId: string | null;
  onSelect: (location: LocalMapLocation) => void;
  onCloseSelection: () => void;
  heightClass?: string;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerLibraryRef = useRef<GoogleMarkerLibrary | null>(null);
  const markersRef = useRef<MarkerHandle[]>([]);
  const mapListenersRef = useRef<Array<{ remove(): void }>>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    void loadGoogleMaps().then(async (google) => {
      if (disposed || !elementRef.current) return;
      const mapId = getGoogleMapsMapId();
      const map = new google.maps.Map(elementRef.current, {
        center: PILOT_CENTER,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        ...(mapId ? { mapId } : {}),
      });
      mapRef.current = map;
      setMapReady(true);
      const markerLibrary = await loadGoogleMarkerLibrary(google);
      if (disposed) return;
      markerLibraryRef.current = markerLibrary;
      setLoading(false);
    }).catch(() => {
      if (disposed) return;
      setError("โหลดแผนที่ไม่สำเร็จ ตรวจสอบ Maps key และโดเมนที่อนุญาต แล้วลองใหม่ได้");
      setLoading(false);
    });

    return () => {
      disposed = true;
      mapListenersRef.current.forEach((listener) => listener.remove());
      mapListenersRef.current = [];
      markersRef.current.forEach((marker) => {
        marker.listeners.forEach((listener) => listener.remove());
        marker.clear();
      });
      markersRef.current = [];
      mapRef.current = null;
      markerLibraryRef.current = null;
      setMapReady(false);
    };
  }, [loadAttempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach((marker) => {
      marker.listeners.forEach((listener) => listener.remove());
      marker.clear();
    });
    markersRef.current = [];
    const valid = locations.filter(hasValidLocalMapPin);
    const google = window.google;
    if (!google) return;

    markersRef.current = valid.map((location, index) => {
      const position = { lat: location.lat!, lng: location.lng! };
      const title = `${location.name}${location.kind === "community" ? " · ชุมชน" : ""}`;
      const AdvancedMarkerElement = markerLibraryRef.current?.AdvancedMarkerElement;
      if (AdvancedMarkerElement && getGoogleMapsMapId()) {
        const marker = new AdvancedMarkerElement({
          map,
          position,
          title,
          content: createMarkerContent(location, location.id === selectedId),
          zIndex: location.id === selectedId ? 20_000 : 10_000 + index,
        });
        const listeners = [marker.addListener("click", () => onSelect(location))];
        return { listeners, clear: () => { marker.map = null; } };
      }

      const marker: GoogleMarker = new google.maps.Marker({
        map,
        position,
        title,
        zIndex: location.id === selectedId ? 20_000 : 10_000 + index,
        label: location.kind === "community" ? "C" : "M",
      });
      const listeners = [marker.addListener("click", () => onSelect(location))];
      return { listeners, clear: () => marker.setMap(null) };
    });

    if (valid.length > 1) {
      const bounds = valid.reduce((result, point) => ({
        north: Math.max(result.north, point.lat!),
        south: Math.min(result.south, point.lat!),
        east: Math.max(result.east, point.lng!),
        west: Math.min(result.west, point.lng!),
      }), { north: valid[0]!.lat!, south: valid[0]!.lat!, east: valid[0]!.lng!, west: valid[0]!.lng! });
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
    } else if (valid.length === 1) {
      map.setCenter({ lat: valid[0]!.lat!, lng: valid[0]!.lng! });
      map.setZoom(15);
    }

    return () => {
      markersRef.current.forEach((marker) => {
        marker.listeners.forEach((listener) => listener.remove());
        marker.clear();
      });
      markersRef.current = [];
    };
  }, [locations, mapReady, onSelect, selectedId]);

  return (
    <section aria-label="แผนที่ MyTree" className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 ${heightClass}`}>
      <div ref={elementRef} className="h-full min-h-[320px] w-full" />
      {loading && <div role="status" className="absolute inset-0 grid place-items-center bg-white/85 text-sm text-gray-600">กำลังโหลดแผนที่…</div>}
      {error && <div role="alert" className="absolute inset-x-4 top-4 rounded-xl border border-amber-200 bg-white p-4 shadow-sm"><p className="text-sm text-amber-900">{error}</p><button type="button" onClick={() => setLoadAttempt((value) => value + 1)} className="mt-3 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">ลองใหม่</button></div>}
      {!loading && !error && locations.filter(hasValidLocalMapPin).length === 0 && <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl bg-white/95 p-3 text-sm text-gray-600 shadow-sm">ไม่มีพิกัดที่ยืนยันได้ในพื้นที่นี้</div>}
      {selectedId && (
        <button type="button" aria-label="ปิดข้อมูลตำแหน่งที่เลือก" onClick={onCloseSelection} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-2xl leading-none text-gray-700 shadow-sm">×</button>
      )}
    </section>
  );
}

function createMarkerContent(location: LocalMapLocation, selected: boolean): HTMLElement {
  const marker = document.createElement("div");
  marker.className = "grid h-10 w-10 place-items-center rounded-full border-2 bg-white text-xs font-black shadow-lg";
  marker.style.borderColor = selected ? "#111827" : location.kind === "community" ? "#2563eb" : "#15803d";
  marker.style.color = selected ? "#111827" : location.kind === "community" ? "#1d4ed8" : "#166534";
  marker.textContent = location.kind === "community" ? "C" : "M";
  marker.setAttribute("aria-label", location.name);
  return marker;
}
