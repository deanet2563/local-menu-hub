import { useEffect, useRef, useState } from "react";
import {
  currentMyTreeMaps,
  loadMyTreeMaps,
  myTreeMapOptions,
  type GoogleMapListener,
  type MyTreeGoogleMap,
  type MyTreeGoogleMarker,
} from "@/lib/myTreeGoogleMaps";

type Point = { lat: number; lng: number };
type ClickableMap = MyTreeGoogleMap & {
  addListener(eventName: "click", handler: (event: { latLng?: { toJSON(): Point } }) => void): GoogleMapListener;
};

export function EmergencyLocationMap({
  point,
  onPointChange,
}: {
  point: Point | null;
  onPointChange: (point: Point) => void;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MyTreeGoogleMap | null>(null);
  const markerRef = useRef<MyTreeGoogleMarker | null>(null);
  const mapClickRef = useRef<GoogleMapListener | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    void loadMyTreeMaps()
      .then((google) => {
        if (disposed || !el.current) return;
        const center = point ?? { lat: 13.7732, lng: 100.6761 };
        const map = new google.maps.Map(el.current, myTreeMapOptions(center, point ? 17 : 14));
        mapRef.current = map;
        mapClickRef.current = (map as ClickableMap).addListener("click", (event) => {
          const next = event.latLng?.toJSON();
          if (next) onPointChange(next);
        });
        setReady(true);
      })
      .catch(() => setError(true));

    return () => {
      disposed = true;
      mapClickRef.current?.remove();
      markerRef.current?.setMap(null);
      mapClickRef.current = null;
      markerRef.current = null;
      mapRef.current = null;
    };
  // The map is initialized once; onPointChange is intentionally captured for the page lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !point || !mapRef.current) return;
    const google = currentMyTreeMaps();
    if (!google) return;
    markerRef.current?.setMap(null);
    markerRef.current = new google.maps.Marker({
      map: mapRef.current,
      position: point,
      title: "จุดเกิดเหตุ",
      zIndex: 30000,
    });
    mapRef.current.panTo(point);
    mapRef.current.setZoom(17);
  }, [point, ready]);

  return (
    <div className="relative h-[300px] overflow-hidden rounded-2xl border bg-[#eef3ec]">
      <div ref={el} className="h-full w-full" />
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-[#f8fbf5] p-5 text-center text-sm">
          <div>
            <p className="font-black">เปิดแผนที่ไม่ได้ในขณะนี้</p>
            <p className="mt-1 text-gray-600">ยังสามารถใช้ GPS หรือ Google Maps link เพื่อระบุตำแหน่งได้</p>
          </div>
        </div>
      )}
      {!error && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-xs shadow">
          แตะแผนที่เพื่อย้ายจุดเกิดเหตุ
        </div>
      )}
    </div>
  );
}
