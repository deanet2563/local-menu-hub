import type { MerchantMapShop } from "@/lib/merchantMapMarkers";

export type MapLocation = { lat: number; lng: number };

export function distanceKm(origin: MapLocation, destination: MapLocation): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function filterMapShops(
  shops: MerchantMapShop[],
  query: string,
  category: string | null,
  openOnly: boolean,
): MerchantMapShop[] {
  const needle = query.trim().toLocaleLowerCase("th-TH");
  return shops.filter((shop) => {
    if (openOnly && shop.isOpen !== true) return false;
    if (category && shop.category !== category) return false;
    if (!needle) return true;
    return [shop.name, shop.category, shop.description, shop.address]
      .some((value) => value?.toLocaleLowerCase("th-TH").includes(needle));
  });
}

export function directionsUrl(shop: Pick<MerchantMapShop, "lat" | "lng">): string {
  const destination = encodeURIComponent(`${shop.lat},${shop.lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export function formatDistance(distance: number | null): string | null {
  if (distance === null || !Number.isFinite(distance)) return null;
  if (distance < 1) return `${Math.max(1, Math.round(distance * 1000))} ม.`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} กม.`;
}
