import {
  boundsForMerchantPoints,
  CHECKOUT_MAP_FIT_PADDING,
  CHECKOUT_MAP_SINGLE_POINT_ZOOM,
  merchantFallbackIcon,
  MERCHANT_MARKER_VIEWPORT_PADDING_DEGREES,
  normalizeMerchantLogoUrl,
  normalizeMerchantMapRows,
  paddedMerchantViewport,
  type MerchantMapRow,
} from "@/lib/merchantMapMarkers";
import {
  isCheckoutMapDebugRouteAllowedHost,
  isPreviewCheckoutMapAuthBypassLocation,
} from "@/lib/previewDebugRoute";

const rows: MerchantMapRow[] = [
  {
    shop_id: "sonbaobao",
    name: "Sample Merchant",
    category: "Bakery",
    description: "Fresh daily",
    address: "Sammakorn",
    logo_url: "https://example.com/logo.jpg",
    is_open: true,
    lat: 13.7771,
    lng: 100.6741,
  },
  {
    shop_id: "missing-lat",
    name: "No Lat",
    category: null,
    description: null,
    address: null,
    logo_url: null,
    is_open: null,
    lat: null,
    lng: 100.6741,
  },
  {
    shop_id: "bad-lng",
    name: "Bad Lng",
    category: null,
    description: null,
    address: null,
    logo_url: "javascript:alert(1)",
    is_open: false,
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
    arbitraryHostBlocked: isCheckoutMapDebugRouteAllowedHost("example.com") === false,
    authBypassRequiresPreviewHostAndExactPath: isPreviewCheckoutMapAuthBypassLocation({
      hostname: "6a526645.local-menu-hub.pages.dev",
      pathname: "/debug/checkout-map",
    }) === true,
    authBypassRejectsCartOnPreview: isPreviewCheckoutMapAuthBypassLocation({
      hostname: "6a526645.local-menu-hub.pages.dev",
      pathname: "/cart",
    }) === false,
    authBypassRejectsDebugPathOnProduction: isPreviewCheckoutMapAuthBypassLocation({
      hostname: "mytree.cc",
      pathname: "/debug/checkout-map",
    }) === false,
  },
  visibleShopNames: normalizeMerchantMapRows(rows).map((shop) => shop.name),
  logoUrl: normalizeMerchantMapRows(rows)[0]?.logoUrl,
  invalidLogoUrl: normalizeMerchantLogoUrl("javascript:alert(1)") === null,
  fallbackIcons: {
    bakery: merchantFallbackIcon("Bakery"),
    drink: merchantFallbackIcon("เครื่องดื่ม"),
    generic: merchantFallbackIcon(null),
  },
};
