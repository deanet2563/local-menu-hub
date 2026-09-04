import liff from "@line/liff";
import { initLiff, isOrderingPreview } from "@/lib/supabase";
import { cart } from "@/lib/cart";

const WORKER_URL = "https://mytree-worker.kompakorn-t.workers.dev";
const LOCATION_RESOLVE_URL = `${WORKER_URL}/location/resolve`;
const LOCATION_SEARCH_URL = `${WORKER_URL}/location/search`;
const DELIVERY_QUOTE_URL = `${WORKER_URL}/delivery/quote`;
export const DELIVERY_PLACE_SEARCH_MIN_LENGTH = 3;

export type DeliveryLocationSource = "device_gps" | "google_maps_url" | "latlng" | "map_pin";
export type DeliveryResolutionMethod = "url_coordinates" | "google_document" | "places_text_search";

export type ConfirmedDeliveryPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  source: DeliveryLocationSource;
  submittedValue?: string | null;
  resolvedUrl?: string | null;
  placeId?: string | null;
  displayName?: string | null;
  formattedAddress?: string | null;
  resolutionMethod?: DeliveryResolutionMethod | null;
};

export type DeliveryRouteQuote = {
  distanceMeters: number;
  durationSeconds: number;
  feeRatePerKm: number;
  deliveryFee: number;
  provider: string;
  quoteToken: string;
  routeDeliveryFee?: number;
  pricingMode?: "distance" | "flat" | "free";
  promotionApplied?: boolean;
  eligibleSubtotal?: number;
};

export type DeliveryPlaceSearchResult = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
};

type ResolveResponse = {
  ok?: boolean;
  location?: {
    lat?: number;
    lng?: number;
    source?: "google_maps_url" | "latlng";
    submittedValue?: string;
    resolvedUrl?: string;
    placeId?: string;
    displayName?: string;
    formattedAddress?: string;
    resolutionMethod?: DeliveryResolutionMethod;
  };
  error?: string;
};

export type DeliveryPlaceSearchResponse = {
  ok?: boolean;
  results?: Array<Partial<DeliveryPlaceSearchResult>>;
  error?: string;
};

type QuoteResponse = {
  ok?: boolean;
  quote?: Omit<DeliveryRouteQuote, "quoteToken">;
  quoteToken?: string;
  error?: string;
};

type QuoteBinding = {
  shopId: string;
  lat: number;
  lng: number;
  token: string;
  cartSignature: string;
};

let latestQuoteBinding: QuoteBinding | null = null;

function currentCartQuoteItems() {
  return cart.getState().items.map((item) => ({
    lineId: item.lineId,
    kind: item.kind,
    itemId: item.itemId,
    qty: item.qty,
    options: item.options.map((option) => ({ groupId: option.groupId, optionId: option.optionId })),
    bundleSelections: item.bundleSelections.map((selection) => ({
      groupId: selection.groupId,
      itemId: selection.itemId,
      qty: selection.qty,
    })),
  }));
}

function currentCartQuoteSignature(): string {
  return JSON.stringify(currentCartQuoteItems());
}

export async function resolveDeliveryLocation(value: string, shopId?: string | null): Promise<ConfirmedDeliveryPoint> {
  const response = await fetch(LOCATION_RESOLVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, shopId: shopId ?? undefined }),
  });
  const payload = await response.json().catch(() => null) as ResolveResponse | null;
  const location = payload?.location;
  if (!response.ok || !payload?.ok || !location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    throw new Error(resolveErrorText(payload?.error));
  }
  return {
    lat: location.lat,
    lng: location.lng,
    accuracy: null,
    source: location.source === "latlng" ? "latlng" : "google_maps_url",
    submittedValue: location.submittedValue ?? value,
    resolvedUrl: location.resolvedUrl ?? null,
    placeId: location.placeId ?? null,
    displayName: location.displayName ?? null,
    formattedAddress: location.formattedAddress ?? null,
    resolutionMethod: location.resolutionMethod ?? null,
  };
}

export async function searchDeliveryPlaces(query: string, shopId?: string | null, signal?: AbortSignal): Promise<DeliveryPlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < DELIVERY_PLACE_SEARCH_MIN_LENGTH) return [];
  const response = await fetch(LOCATION_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: trimmed, shopId: shopId ?? undefined, limit: 5 }),
    signal,
  });
  const payload = await response.json().catch(() => null) as DeliveryPlaceSearchResponse | null;
  if (!response.ok || !payload?.ok) throw new Error(resolveErrorText(payload?.error));
  return normalizeDeliveryPlaceSearchResults(payload);
}

export function normalizeDeliveryPlaceSearchResults(payload: DeliveryPlaceSearchResponse): DeliveryPlaceSearchResult[] {
  return (payload.results ?? [])
    .filter((result): result is DeliveryPlaceSearchResult => (
      typeof result.placeId === "string"
      && typeof result.displayName === "string"
      && typeof result.formattedAddress === "string"
      && typeof result.lat === "number"
      && Number.isFinite(result.lat)
      && typeof result.lng === "number"
      && Number.isFinite(result.lng)
    ))
    .slice(0, 5);
}

export async function quoteDeliveryRoute(shopId: string, point: Pick<ConfirmedDeliveryPoint, "lat" | "lng">): Promise<DeliveryRouteQuote> {
  await initLiff();
  if (!liff.isLoggedIn()) {
    if (isOrderingPreview()) {
      throw new Error("โหมดทดสอบต้องเปิดผ่าน LIFF staging ก่อนคำนวณค่าส่งจริง");
    }
    liff.login();
    throw new Error("กำลังเข้าสู่ระบบ LINE...");
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("ไม่พบ LINE idToken สำหรับคำนวณค่าส่ง");

  const items = currentCartQuoteItems();
  if (!items.length) throw new Error("ตะกร้าว่าง ไม่สามารถคำนวณค่าส่งได้");
  const cartSignature = JSON.stringify(items);

  const response = await fetch(DELIVERY_QUOTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, shopId, destinationLat: point.lat, destinationLng: point.lng, items }),
  });
  const payload = await response.json().catch(() => null) as QuoteResponse | null;
  if (!response.ok || !payload?.ok || !payload.quote || !payload.quoteToken) {
    latestQuoteBinding = null;
    throw new Error(quoteErrorText(payload?.error));
  }

  latestQuoteBinding = {
    shopId,
    lat: point.lat,
    lng: point.lng,
    token: payload.quoteToken,
    cartSignature,
  };
  return { ...payload.quote, quoteToken: payload.quoteToken };
}

export function getDeliveryQuoteToken(shopId: string, lat: number | null, lng: number | null): string | null {
  const binding = latestQuoteBinding;
  if (!binding || typeof lat !== "number" || typeof lng !== "number") return null;
  if (binding.shopId !== shopId) return null;
  if (Math.abs(binding.lat - lat) > 0.000001 || Math.abs(binding.lng - lng) > 0.000001) return null;
  if (binding.cartSignature !== currentCartQuoteSignature()) return null;
  return binding.token;
}

export function googleMapsPreviewUrl(point: Pick<ConfirmedDeliveryPoint, "lat" | "lng" | "placeId">): string {
  if (point.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}&query_place_id=${encodeURIComponent(point.placeId)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
}

function resolveErrorText(code?: string): string {
  switch (code) {
    case "google_maps_url_required": return "รองรับเฉพาะ Google Maps link หรือ latitude, longitude";
    case "google_maps_link_unreachable": return "เปิด Google Maps link นี้ไม่ได้ กรุณาตรวจลิงก์แล้วลองใหม่";
    case "google_maps_coordinates_not_found": return "ยังอ่านพิกัดจาก Google Maps link นี้ไม่ได้ กรุณาใช้ลิงก์ Share Location หรือวาง latitude, longitude";
    case "google_places_not_configured": return "ระบบ Google Places ยังไม่พร้อม กรุณาลองใหม่ภายหลัง";
    case "google_places_failed": return "Google Places ตรวจสอบชื่อและพิกัดสถานที่ไม่สำเร็จ กรุณาลองใหม่";
    case "unsupported_location_format": return "รูปแบบจุดส่งไม่ถูกต้อง กรุณาวาง Google Maps link หรือ latitude, longitude";
    default: return "ตรวจจุดส่งไม่สำเร็จ กรุณาลองใหม่";
  }
}

function quoteErrorText(code?: string): string {
  switch (code) {
    case "authentication_required": return "กรุณาเข้าสู่ระบบ LINE ก่อนคำนวณค่าส่ง";
    case "invalid_line_id_token": return "LINE session หมดอายุ กรุณาเปิด MyTree ผ่าน LINE ใหม่";
    case "quote_rate_limited": return "มีการคำนวณค่าส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
    case "shop_location_not_configured": return "ร้านยังไม่ได้บันทึกพิกัด จึงคำนวณค่าส่งไม่ได้";
    case "google_routes_not_configured": return "ระบบเส้นทางยังไม่ได้ตั้งค่า Google Routes API";
    case "google_routes_no_route": return "ไม่พบเส้นทางมอเตอร์ไซค์ระหว่างร้านและจุดส่ง";
    case "google_routes_failed": return "Google Routes คำนวณเส้นทางไม่สำเร็จ กรุณาลองใหม่";
    case "cart_items_required": return "กรุณาเพิ่มสินค้าในตะกร้าก่อนคำนวณค่าส่ง";
    case "cart_item_unavailable": return "มีสินค้าในตะกร้าที่ไม่พร้อมขาย กรุณาตรวจตะกร้าใหม่";
    case "shop_delivery_policy_not_configured": return "ร้านยังตั้งค่านโยบายค่าส่งไม่ครบ";
    default: return "คำนวณระยะทางและค่าส่งไม่สำเร็จ กรุณาลองใหม่";
  }
}