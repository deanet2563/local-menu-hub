import { isValidMerchantCoordinate } from "@/lib/merchantMapMarkers";

/** MyTree-owned location contract. Renderer/provider IDs never belong here. */
export type LocalMapLocation = {
  id: string;
  kind: "shop" | "community";
  name: string;
  category: string | null;
  address: string | null;
  communityName: string | null;
  lat: number | null;
  lng: number | null;
  approved: boolean;
  banned: boolean;
  isOpen: boolean | null;
  mapVisible: boolean;
  verificationStatus: "unverified" | "verified" | "correction_pending" | "rejected";
  locationUpdatedAt: string | null;
  locationVerifiedAt: string | null;
  locationSource: string | null;
  provenance: "mytree_shop" | "mytree_community";
};

export type LocalMapLocationRow = {
  id: string;
  kind: "shop" | "community";
  name: string;
  category?: string | null;
  address?: string | null;
  community_name?: string | null;
  lat: number | null;
  lng: number | null;
  approved?: boolean;
  banned?: boolean;
  is_open?: boolean | null;
  map_visible?: boolean;
  verification_status?: LocalMapLocation["verificationStatus"] | null;
  location_updated_at?: string | null;
  location_verified_at?: string | null;
  location_source?: string | null;
};

export function normalizeLocalMapLocation(row: LocalMapLocationRow): LocalMapLocation {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    category: row.category ?? null,
    address: row.address ?? null,
    communityName: row.community_name ?? null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    approved: row.approved ?? true,
    banned: row.banned ?? false,
    isOpen: row.is_open ?? null,
    mapVisible: row.map_visible ?? false,
    verificationStatus: row.verification_status ?? "unverified",
    locationUpdatedAt: row.location_updated_at ?? null,
    locationVerifiedAt: row.location_verified_at ?? null,
    locationSource: row.location_source ?? null,
    provenance: row.kind === "shop" ? "mytree_shop" : "mytree_community",
  };
}

export function hasValidLocalMapPin(location: Pick<LocalMapLocation, "lat" | "lng">): boolean {
  return isValidMerchantCoordinate(location.lat, location.lng);
}

/** Public map rule: only approved, active, explicitly visible, valid MyTree pins. */
export function isPublicMapLocation(location: LocalMapLocation): boolean {
  return location.kind === "community"
    ? location.mapVisible && hasValidLocalMapPin(location)
    : location.approved && !location.banned && location.mapVisible && hasValidLocalMapPin(location);
}

export function localMapQuality(location: LocalMapLocation): "missing" | "invalid" | "stale" | "verified" | "unverified" {
  if (location.lat === null || location.lng === null) return "missing";
  if (!hasValidLocalMapPin(location)) return "invalid";
  const freshness = location.locationVerifiedAt ?? location.locationUpdatedAt;
  if (freshness && Date.now() - new Date(freshness).getTime() > 365 * 24 * 60 * 60 * 1000) return "stale";
  return location.verificationStatus === "verified" ? "verified" : "unverified";
}

export function duplicateLocationIds(locations: LocalMapLocation[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const location of locations) {
    if (!hasValidLocalMapPin(location)) continue;
    const key = `${location.lat!.toFixed(6)},${location.lng!.toFixed(6)}`;
    groups.set(key, [...(groups.get(key) ?? []), location.id]);
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
}
