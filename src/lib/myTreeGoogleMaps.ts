export type LatLngLiteral = { lat: number; lng: number };
export type GoogleMapListener = { remove(): void };
export type MyTreeGoogleMap = {
  fitBounds(bounds: { extend(point: LatLngLiteral): void }, padding: number): void;
  panTo(position: LatLngLiteral): void;
  setZoom(zoom: number): void;
};
export type MyTreeGoogleMarker = {
  setMap(map: MyTreeGoogleMap | null): void;
  addListener(eventName: "click", handler: () => void): GoogleMapListener;
};
export type MyTreeGoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => MyTreeGoogleMap;
    Marker: new (options: Record<string, unknown>) => MyTreeGoogleMarker;
    LatLngBounds: new () => { extend(point: LatLngLiteral): void };
    Size?: new (width: number, height: number) => unknown;
    Point?: new (x: number, y: number) => unknown;
  };
};

let mapsPromise: Promise<MyTreeGoogleMapsApi> | null = null;

export function currentMyTreeMaps(): MyTreeGoogleMapsApi | undefined {
  return (window as unknown as { google?: MyTreeGoogleMapsApi }).google;
}

export function loadMyTreeMaps(): Promise<MyTreeGoogleMapsApi> {
  const ready = currentMyTreeMaps();
  if (ready) return Promise.resolve(ready);
  if (mapsPromise) return mapsPromise;
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) return Promise.reject(new Error("maps_key_missing"));
  const attempt = new Promise<MyTreeGoogleMapsApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-mytree-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => currentMyTreeMaps() ? resolve(currentMyTreeMaps()!) : reject(new Error("maps_load_failed")), { once: true });
      existing.addEventListener("error", () => reject(new Error("maps_load_failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true; script.defer = true; script.dataset.mytreeGoogleMaps = "true";
    script.addEventListener("load", () => currentMyTreeMaps() ? resolve(currentMyTreeMaps()!) : reject(new Error("maps_load_failed")), { once: true });
    script.addEventListener("error", () => reject(new Error("maps_load_failed")), { once: true });
    document.head.appendChild(script);
  }).catch((error): never => {
    mapsPromise = null;
    if (!currentMyTreeMaps()) document.querySelector<HTMLScriptElement>("script[data-mytree-google-maps]")?.remove();
    throw error;
  });
  mapsPromise = attempt;
  return attempt;
}

export function myTreeMapOptions(center: LatLngLiteral, zoom = 14): Record<string, unknown> {
  return {
    center, zoom, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
    ...(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ? { mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID } : {}),
  };
}
