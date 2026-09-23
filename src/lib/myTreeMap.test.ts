import { directionsUrl, distanceKm, filterMapShops, formatDistance, groupMapShopsByCoordinate } from "@/lib/myTreeMap";
import type { MerchantMapShop } from "@/lib/merchantMapMarkers";

const shops: MerchantMapShop[] = [
  { shopId: "1", name: "ครัวต้นไม้", category: "อาหาร", description: "ข้าวตามสั่ง", address: "ซอย G14", logoUrl: null, isOpen: true, lat: 13.77, lng: 100.67 },
  { shopId: "2", name: "ชาใกล้บ้าน", category: "เครื่องดื่ม", description: null, address: "หน้าสโมสร", logoUrl: null, isOpen: false, lat: 13.78, lng: 100.68 },
  { shopId: "3", name: "ร้านร่วมพิกัด", category: "อาหาร", description: null, address: "ซอย G14", logoUrl: null, isOpen: true, lat: 13.7700001, lng: 100.6700001 },
];

export const myTreeMapCompileChecks = {
  searchAddress: filterMapShops(shops, "G14", null, false).map((shop) => shop.shopId),
  searchThaiName: filterMapShops(shops, "ชา", null, false).map((shop) => shop.shopId),
  openFood: filterMapShops(shops, "", "อาหาร", true).map((shop) => shop.shopId),
  closedDrinkExcluded: filterMapShops(shops, "", "เครื่องดื่ม", true).length === 0,
  zeroDistance: distanceKm({ lat: 13.77, lng: 100.67 }, { lat: 13.77, lng: 100.67 }),
  meterLabel: formatDistance(0.42),
  kilometerLabel: formatDistance(2.34),
  directions: directionsUrl(shops[0]!),
  coLocatedPinsGrouped: groupMapShopsByCoordinate(shops).some((group) => group.length === 2),
};
