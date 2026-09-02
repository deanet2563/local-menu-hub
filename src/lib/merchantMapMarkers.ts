export const MERCHANT_MARKER_VIEWPORT_PADDING_DEGREES = 0.01;
export const MERCHANT_MARKER_QUERY_LIMIT = 100;
export const CHECKOUT_MAP_SINGLE_POINT_ZOOM = 15;
export const CHECKOUT_MAP_FIT_PADDING = { top: 56, right: 32, bottom: 112, left: 32 } as const;

export type MerchantMapViewport = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MerchantMapRow = {
  shop_id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type MerchantMapShop = {
  shopId: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  lat: number;
  lng: number;
};

export type MerchantMapBoundsPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function isValidMerchantCoordinate(lat: number | null, lng: number | null): lat is number {
  return (
    typeof lat === "number"
    && Number.isFinite(lat)
    && lat >= -90
    && lat <= 90
    && typeof lng === "number"
    && Number.isFinite(lng)
    && lng >= -180
    && lng <= 180
  );
}

export function normalizeMerchantMapRows(rows: MerchantMapRow[]): MerchantMapShop[] {
  return rows
    .filter((row) => isValidMerchantCoordinate(row.lat, row.lng))
    .map((row) => ({
      shopId: row.shop_id,
      name: row.name,
      category: row.category,
      description: row.description,
      address: row.address,
      lat: row.lat as number,
      lng: row.lng as number,
    }));
}

export function paddedMerchantViewport(viewport: MerchantMapViewport): MerchantMapViewport {
  const padding = MERCHANT_MARKER_VIEWPORT_PADDING_DEGREES;
  return {
    north: Math.min(90, viewport.north + padding),
    south: Math.max(-90, viewport.south - padding),
    east: Math.min(180, viewport.east + padding),
    west: Math.max(-180, viewport.west - padding),
  };
}

export function boundsForMerchantPoints(points: Array<{ lat: number; lng: number }>): MerchantMapViewport | null {
  const valid = points.filter((point) => isValidMerchantCoordinate(point.lat, point.lng));
  if (valid.length === 0) return null;
  return valid.reduce<MerchantMapViewport>((bounds, point) => ({
    north: Math.max(bounds.north, point.lat),
    south: Math.min(bounds.south, point.lat),
    east: Math.max(bounds.east, point.lng),
    west: Math.min(bounds.west, point.lng),
  }), {
    north: valid[0]!.lat,
    south: valid[0]!.lat,
    east: valid[0]!.lng,
    west: valid[0]!.lng,
  });
}
