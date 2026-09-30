export type LatLngLiteral = { lat: number; lng: number };

export type GoogleMap = {
  setCenter(position: LatLngLiteral): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: { north: number; south: number; east: number; west: number }, padding: number | { top: number; right: number; bottom: number; left: number }): void;
  getBounds(): { getNorthEast(): { lat(): number; lng(): number }; getSouthWest(): { lat(): number; lng(): number } } | undefined;
  addListener(eventName: "click", handler: (event: { latLng?: { lat(): number; lng(): number } }) => void): { remove(): void };
  addListener(eventName: "idle", handler: () => void): { remove(): void };
};

export type GoogleMarker = {
  setMap(map: GoogleMap | null): void;
  setPosition(position: LatLngLiteral): void;
  addListener(eventName: "click", handler: () => void): { remove(): void };
  addListener(eventName: "dragend", handler: (event: { latLng?: { lat(): number; lng(): number } }) => void): { remove(): void };
};

export type GoogleAdvancedMarker = {
  map: GoogleMap | null;
  addListener(eventName: "click", handler: () => void): { remove(): void };
};

export type GoogleMarkerIcon = { url: string; scaledSize: unknown; anchor: unknown };

export type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: { center: LatLngLiteral; zoom: number; mapTypeControl: boolean; streetViewControl: boolean; fullscreenControl: boolean; mapId?: string }) => GoogleMap;
    Marker: new (options: { map: GoogleMap; position: LatLngLiteral; draggable?: boolean; title?: string; zIndex?: number; label?: string | { text: string; color?: string; fontSize?: string; fontWeight?: string }; icon?: GoogleMarkerIcon }) => GoogleMarker;
    Size?: new (width: number, height: number) => unknown;
    Point?: new (x: number, y: number) => unknown;
    importLibrary?: (name: string) => Promise<unknown>;
    marker?: {
      AdvancedMarkerElement: new (options: { map: GoogleMap; position: LatLngLiteral; title: string; content: HTMLElement; zIndex: number }) => GoogleAdvancedMarker;
    };
  };
};

export type GoogleMarkerLibrary = {
  AdvancedMarkerElement: new (options: { map: GoogleMap; position: LatLngLiteral; title: string; content: HTMLElement; zIndex: number }) => GoogleAdvancedMarker;
};

declare global {
  interface Window { google?: GoogleMapsApi }
}

let mapsLoadPromise: Promise<GoogleMapsApi> | null = null;
let markerLibraryLoadPromise: Promise<GoogleMarkerLibrary | null> | null = null;

export function getGoogleMapsMapId(): string | null {
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
  return mapId ? String(mapId) : null;
}

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("maps_browser_required"));
  if (window.google) return Promise.resolve(window.google);
  if (mapsLoadPromise) return mapsLoadPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? "";
  if (!key) return Promise.reject(new Error("maps_key_missing"));

  let script = document.querySelector<HTMLScriptElement>("script[data-mytree-google-maps]");
  if (script?.dataset.mytreeGoogleMapsStatus === "error") {
    script.remove();
    script = null;
  }
  mapsLoadPromise = new Promise((resolve, reject) => {
    const loaded = () => {
      if (window.google) {
        if (script) script.dataset.mytreeGoogleMapsStatus = "loaded";
        resolve(window.google);
      } else {
        failed();
      }
    };
    const failed = () => {
      if (script) {
        script.dataset.mytreeGoogleMapsStatus = "error";
        script.remove();
      }
      mapsLoadPromise = null;
      markerLibraryLoadPromise = null;
      reject(new Error("maps_load_failed"));
    };

    if (script?.dataset.mytreeGoogleMapsStatus === "loaded" && window.google) {
      resolve(window.google);
      return;
    }
    if (!script) {
      script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker`;
      script.async = true;
      script.defer = true;
      script.dataset.mytreeGoogleMaps = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
  });
  return mapsLoadPromise;
}

/** Advanced markers require a configured Map ID; callers fall back to legacy markers otherwise. */
export async function loadGoogleMarkerLibrary(google: GoogleMapsApi): Promise<GoogleMarkerLibrary | null> {
  if (!getGoogleMapsMapId()) return null;
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
