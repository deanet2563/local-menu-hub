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
  isPreviewDebugAuthBypassLocation,
} from "@/lib/previewDebugRoute";

type Hex = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "a" | "b" | "c" | "d" | "e" | "f";
type BlockedPreviewDebugHost = "mytree.cc" | "www.mytree.cc" | "local-menu-hub.pages.dev";
type PreviewDebugAuthBypassPath = "/debug/checkout-map" | "/debug/line-session-recovery";
type IsHexChar<Value extends string> = Value extends Hex ? true : false;
type IsEightHexPrefix<Value extends string> =
  Value extends `${infer A}${infer B}${infer C}${infer D}${infer E}${infer F}${infer G}${infer H}`
    ? Value extends `${string}${infer Extra}`
      ? string extends Extra
        ? false
        : IsHexChar<A> extends true
          ? IsHexChar<B> extends true
            ? IsHexChar<C> extends true
              ? IsHexChar<D> extends true
                ? IsHexChar<E> extends true
                  ? IsHexChar<F> extends true
                    ? IsHexChar<G> extends true
                      ? IsHexChar<H>
                      : false
                    : false
                  : false
                : false
              : false
            : false
          : false
      : false
    : false;
type IsEightHexPreviewHost<Hostname extends string> =
  Hostname extends `${infer Prefix}.local-menu-hub.pages.dev` ? IsEightHexPrefix<Prefix> : false;
type PreviewDebugAuthBypassAllowed<Hostname extends string, Pathname extends string> =
  Hostname extends BlockedPreviewDebugHost
    ? false
    : IsEightHexPreviewHost<Hostname> extends true
      ? Pathname extends PreviewDebugAuthBypassPath
        ? true
        : false
      : false;
type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;

export type PreviewDebugAuthBypassSecurityContract = {
  hashedPreviewRecoveryAllowed: AssertTrue<PreviewDebugAuthBypassAllowed<"6a526645.local-menu-hub.pages.dev", "/debug/line-session-recovery">>;
  hashedPreviewCartDenied: AssertFalse<PreviewDebugAuthBypassAllowed<"6a526645.local-menu-hub.pages.dev", "/cart">>;
  branchAliasRecoveryDenied: AssertFalse<PreviewDebugAuthBypassAllowed<"codex-line-session-recovery.local-menu-hub.pages.dev", "/debug/line-session-recovery">>;
  productionPagesRecoveryDenied: AssertFalse<PreviewDebugAuthBypassAllowed<"local-menu-hub.pages.dev", "/debug/line-session-recovery">>;
  productionDomainRecoveryDenied: AssertFalse<PreviewDebugAuthBypassAllowed<"mytree.cc", "/debug/line-session-recovery">>;
  wwwProductionDomainRecoveryDenied: AssertFalse<PreviewDebugAuthBypassAllowed<"www.mytree.cc", "/debug/line-session-recovery">>;
};

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
    authBypassRequiresPreviewHostAndExactCheckoutMapPath: isPreviewDebugAuthBypassLocation({
      hostname: "6a526645.local-menu-hub.pages.dev",
      pathname: "/debug/checkout-map",
    }) === true,
    authBypassAllowsExactRecoveryPathOnHashedPreview: isPreviewDebugAuthBypassLocation({
      hostname: "6a526645.local-menu-hub.pages.dev",
      pathname: "/debug/line-session-recovery",
    }) === true,
    authBypassRejectsCartOnPreview: isPreviewDebugAuthBypassLocation({
      hostname: "6a526645.local-menu-hub.pages.dev",
      pathname: "/cart",
    }) === false,
    authBypassRejectsRecoveryPathOnBranchAlias: isPreviewDebugAuthBypassLocation({
      hostname: "codex-line-session-recovery.local-menu-hub.pages.dev",
      pathname: "/debug/line-session-recovery",
    }) === false,
    authBypassRejectsRecoveryPathOnProductionPages: isPreviewDebugAuthBypassLocation({
      hostname: "local-menu-hub.pages.dev",
      pathname: "/debug/line-session-recovery",
    }) === false,
    authBypassRejectsRecoveryPathOnProductionDomain: isPreviewDebugAuthBypassLocation({
      hostname: "mytree.cc",
      pathname: "/debug/line-session-recovery",
    }) === false,
    authBypassRejectsRecoveryPathOnWwwProductionDomain: isPreviewDebugAuthBypassLocation({
      hostname: "www.mytree.cc",
      pathname: "/debug/line-session-recovery",
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
