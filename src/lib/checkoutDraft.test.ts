import {
  buildCheckoutDraftKey,
  sanitizeCheckoutDraftForStorage,
  shouldRestoreCheckoutDraft,
  type CheckoutDraft,
} from "@/lib/checkoutDraft";

const draft: CheckoutDraft = {
  savedAt: "2026-09-01T01:00:00.000Z",
  customerName: "PJ",
  customerPhone: "0812345678",
  fulfillment: "delivery",
  payment: "cash",
  timing: "preorder",
  requestedForLocal: "2026-09-01T12:30",
  premises: "99/1",
  locality: "Sammakorn Bangkok",
  riderInstructions: "Gate 2",
  storeNote: "No chili",
  selectedAddressId: "local_1",
  saveAddress: true,
  saveAddressLabel: "Home",
  makeDefaultAddress: false,
  destination: {
    lat: 13.77314,
    lng: 100.67611,
    source: "map_pin",
    accuracy: null,
    placeId: "places/abc",
    displayName: "The Paseo",
    formattedAddress: "Bangkok",
    submittedMapUrl: null,
  },
  routeQuoteToken: "short-lived-token",
};

export const checkoutDraftCompileChecks = {
  scopedKey: buildCheckoutDraftKey({ customerId: "customer-a", shopId: "shop-a" }),
  restored: shouldRestoreCheckoutDraft(draft, new Date("2026-09-01T12:00:00.000Z")),
  expired: shouldRestoreCheckoutDraft(draft, new Date("2026-09-02T02:00:01.000Z")),
  sanitized: sanitizeCheckoutDraftForStorage(draft).routeQuoteToken,
};
