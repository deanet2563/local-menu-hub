import {
  boundsForMerchantPoints,
  CHECKOUT_MAP_FIT_PADDING,
  CHECKOUT_MAP_SINGLE_POINT_ZOOM,
  isCheckoutMapDebugRouteAllowedHost,
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
  fitPadding: CHECKOUT_MAP_FIT_PADDING,
  singlePointZoom: CHECKOUT_MAP_SINGLE_POINT_ZOOM,
  padding: MERCHANT_MARKER_VIEWPORT_PADDING_DEGREES,
  bounds: paddedMerchantViewport({
    north: 13.78,
    south: 13.77,
    east: 100.68,
    west: 100.67,
  }),
  shopAndDestinationBounds: boundsForMerchantPoints([
    { lat: 13.789336, lng: 100.686407 },
    { lat: 13.773212302227083, lng: 100.67610292467903 },
  ]),
  debugHostGate: {
    productionDomainBlocked: isCheckoutMapDebugRouteAllowedHost("mytree.cc") === false,
    wwwProductionDomainBlocked: isCheckoutMapDebugRouteAllowedHost("www.mytree.cc") === false,
    productionPagesBlocked: isCheckoutMapDebugRouteAllowedHost("local-menu-hub.pages.dev") === false,
    hashedPreviewAllowed: isCheckoutMapDebugRouteAllowedHost("6a526645.local-menu-hub.pages.dev") === true,
  },
  visibleShopNames: normalizeMerchantMapRows(rows).map((shop) => shop.name),
};
