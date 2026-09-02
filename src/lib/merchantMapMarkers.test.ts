import {
  MERCHANT_MARKER_VIEWPORT_PADDING_DEGREES,
  normalizeMerchantMapRows,
  paddedMerchantViewport,
  type MerchantMapRow,
} from "@/lib/merchantMapMarkers";

const rows: MerchantMapRow[] = [
  {
    shop_id: "sonbaobao",
    name: "Sample Merchant",
    category: "Bakery",
    description: "Fresh daily",
    address: "Sammakorn",
    lat: 13.7771,
    lng: 100.6741,
  },
  {
    shop_id: "missing-lat",
    name: "No Lat",
    category: null,
    description: null,
    address: null,
    lat: null,
    lng: 100.6741,
  },
  {
    shop_id: "bad-lng",
    name: "Bad Lng",
    category: null,
    description: null,
    address: null,
    lat: 13.7771,
    lng: 999,
  },
];

export const merchantMapMarkersCompileChecks = {
  padding: MERCHANT_MARKER_VIEWPORT_PADDING_DEGREES,
  bounds: paddedMerchantViewport({
    north: 13.78,
    south: 13.77,
    east: 100.68,
    west: 100.67,
  }),
  visibleShopNames: normalizeMerchantMapRows(rows).map((shop) => shop.name),
};
