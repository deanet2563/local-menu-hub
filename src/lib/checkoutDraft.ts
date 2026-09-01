import type { DeliveryLocationSource } from "@/lib/deliveryLocation";

export type CheckoutDraftDestination = {
  lat: number;
  lng: number;
  source: DeliveryLocationSource;
  accuracy: number | null;
  placeId: string | null;
  displayName: string | null;
  formattedAddress: string | null;
  submittedMapUrl: string | null;
};

export type CheckoutDraft = {
  savedAt: string;
  customerName: string;
  customerPhone: string;
  fulfillment: "delivery" | "pickup";
  payment: "cash" | "qr_transfer";
  timing: "now" | "preorder";
  requestedForLocal: string;
  premises: string;
  locality: string;
  riderInstructions: string;
  storeNote: string;
  selectedAddressId: string | null;
  saveAddress: boolean;
  saveAddressLabel: string;
  makeDefaultAddress: boolean;
  destination: CheckoutDraftDestination | null;
  routeQuoteToken?: string;
};

const STORAGE_PREFIX = "mytree.checkoutDraft.v1";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function buildCheckoutDraftKey(input: { customerId: string | null; shopId: string | null }): string | null {
  if (!input.customerId || !input.shopId) return null;
  return `${STORAGE_PREFIX}.${input.customerId}.${input.shopId}`;
}

export function shouldRestoreCheckoutDraft(draft: Pick<CheckoutDraft, "savedAt">, now = new Date()): boolean {
  const savedAt = Date.parse(draft.savedAt);
  if (!Number.isFinite(savedAt)) return false;
  return now.getTime() - savedAt <= DRAFT_TTL_MS;
}

export function sanitizeCheckoutDraftForStorage(draft: CheckoutDraft): CheckoutDraft {
  const { routeQuoteToken: _routeQuoteToken, ...safeDraft } = draft;
  return safeDraft;
}

export function loadCheckoutDraft(customerId: string | null, shopId: string | null): CheckoutDraft | null {
  if (typeof window === "undefined") return null;
  const key = buildCheckoutDraftKey({ customerId, shopId });
  if (!key) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutDraft;
    if (!isCheckoutDraft(parsed) || !shouldRestoreCheckoutDraft(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function saveCheckoutDraft(customerId: string | null, shopId: string | null, draft: CheckoutDraft): void {
  if (typeof window === "undefined") return;
  const key = buildCheckoutDraftKey({ customerId, shopId });
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(sanitizeCheckoutDraftForStorage(draft)));
}

export function clearCheckoutDraft(customerId: string | null, shopId: string | null): void {
  if (typeof window === "undefined") return;
  const key = buildCheckoutDraftKey({ customerId, shopId });
  if (key) window.localStorage.removeItem(key);
}

function isCheckoutDraft(value: unknown): value is CheckoutDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<CheckoutDraft>;
  if (typeof draft.savedAt !== "string") return false;
  if (draft.fulfillment !== "delivery" && draft.fulfillment !== "pickup") return false;
  if (draft.payment !== "cash" && draft.payment !== "qr_transfer") return false;
  if (draft.timing !== "now" && draft.timing !== "preorder") return false;
  return typeof draft.customerName === "string"
    && typeof draft.customerPhone === "string"
    && typeof draft.requestedForLocal === "string"
    && typeof draft.premises === "string"
    && typeof draft.locality === "string"
    && typeof draft.riderInstructions === "string"
    && typeof draft.storeNote === "string"
    && typeof draft.saveAddress === "boolean"
    && typeof draft.saveAddressLabel === "string"
    && typeof draft.makeDefaultAddress === "boolean"
    && (draft.selectedAddressId === null || typeof draft.selectedAddressId === "string")
    && (draft.destination === null || isCheckoutDraftDestination(draft.destination));
}

function isCheckoutDraftDestination(value: unknown): value is CheckoutDraftDestination {
  if (!value || typeof value !== "object") return false;
  const destination = value as Partial<CheckoutDraftDestination>;
  return typeof destination.lat === "number"
    && Number.isFinite(destination.lat)
    && typeof destination.lng === "number"
    && Number.isFinite(destination.lng)
    && typeof destination.source === "string"
    && (destination.accuracy === null || typeof destination.accuracy === "number")
    && (destination.placeId === null || typeof destination.placeId === "string")
    && (destination.displayName === null || typeof destination.displayName === "string")
    && (destination.formattedAddress === null || typeof destination.formattedAddress === "string")
    && (destination.submittedMapUrl === null || typeof destination.submittedMapUrl === "string");
}
