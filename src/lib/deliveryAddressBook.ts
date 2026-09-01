import type { DeliveryLocationSource } from "@/lib/deliveryLocation";

export type CustomerDeliveryAddressKind = "recent" | "saved";

export type CustomerDeliveryAddress = {
  id: string;
  kind: CustomerDeliveryAddressKind;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  premises: string;
  locality: string;
  riderNote: string;
  placeId: string | null;
  placeDisplayName: string | null;
  formattedAddress: string | null;
  deliveryPinLat: number;
  deliveryPinLng: number;
  locationSource: DeliveryLocationSource;
  submittedMapUrl: string | null;
  locationAccuracyM: number | null;
  isDefault: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryAddressBookInput = Omit<
  CustomerDeliveryAddress,
  "id" | "kind" | "label" | "isDefault" | "usageCount" | "lastUsedAt" | "createdAt" | "updatedAt"
>;

export type AddressBookUpsertOptions = {
  selectedAddressId?: string | null;
  saveRequested?: boolean;
  saveLabel?: string;
  makeDefault?: boolean;
  usedAt?: string;
};

const STORAGE_PREFIX = "mytree.customerDeliveryAddresses.v1";

export function loadCustomerDeliveryAddresses(customerId: string): CustomerDeliveryAddress[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey(customerId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CustomerDeliveryAddress[];
    return Array.isArray(parsed) ? parsed.filter(isCustomerDeliveryAddress).sort(sortAddresses) : [];
  } catch {
    return [];
  }
}

export function saveCustomerDeliveryAddresses(customerId: string, addresses: CustomerDeliveryAddress[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(customerId), JSON.stringify(addresses.sort(sortAddresses)));
}

export function upsertUsedDeliveryAddress(
  addresses: CustomerDeliveryAddress[],
  input: DeliveryAddressBookInput,
  options: AddressBookUpsertOptions = {},
): CustomerDeliveryAddress[] {
  const now = options.usedAt ?? new Date().toISOString();
  const normalizedLabel = options.saveLabel?.trim() || null;
  const selectedIndex = options.selectedAddressId
    ? addresses.findIndex((address) => address.id === options.selectedAddressId)
    : -1;
  const matchedIndex = selectedIndex >= 0
    ? selectedIndex
    : addresses.findIndex((address) => makeDeliveryAddressKey(address) === makeDeliveryAddressKey(input));

  const next = [...addresses];
  const existing = matchedIndex >= 0 ? next[matchedIndex] : null;
  const shouldSave = Boolean(options.saveRequested);
  const kind: CustomerDeliveryAddressKind = existing?.kind === "saved" || shouldSave ? "saved" : "recent";
  const label = existing?.kind === "saved"
    ? existing.label
    : shouldSave
      ? normalizedLabel
      : existing?.label ?? null;

  const base = existing?.kind === "saved" && !shouldSave ? existing : input;
  const updated: CustomerDeliveryAddress = {
    ...base,
    id: existing?.id ?? `local_${now}_${Math.random().toString(36).slice(2, 10)}`,
    kind,
    label,
    isDefault: Boolean(options.makeDefault) || Boolean(existing?.isDefault),
    usageCount: (existing?.usageCount ?? 0) + 1,
    lastUsedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (matchedIndex >= 0) next[matchedIndex] = updated;
  else next.push(updated);

  const defaulted = updated.isDefault
    ? next.map((address) => ({ ...address, isDefault: address.id === updated.id }))
    : next;

  return defaulted.sort(sortAddresses).slice(0, 10);
}

export function makeDeliveryAddressKey(
  address: Pick<CustomerDeliveryAddress | DeliveryAddressBookInput, "placeId" | "deliveryPinLat" | "deliveryPinLng" | "premises" | "locality">,
): string {
  const pin = `${roundPin(address.deliveryPinLat)},${roundPin(address.deliveryPinLng)}`;
  if (address.placeId) return `place:${address.placeId}:${pin}`;
  return `pin:${pin}:${normalizeText(address.premises)}:${normalizeText(address.locality)}`;
}

export function formatDeliveryAddressSummary(address: Pick<CustomerDeliveryAddress, "premises" | "locality">): string {
  return [address.premises.trim(), address.locality.trim()].filter(Boolean).join(" ");
}

function storageKey(customerId: string): string {
  return `${STORAGE_PREFIX}.${customerId}`;
}

function sortAddresses(a: CustomerDeliveryAddress, b: CustomerDeliveryAddress): number {
  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
  return Date.parse(b.lastUsedAt ?? b.updatedAt) - Date.parse(a.lastUsedAt ?? a.updatedAt);
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("th-TH").replace(/\s+/g, " ");
}

function roundPin(value: number): string {
  return value.toFixed(5);
}

function isCustomerDeliveryAddress(value: unknown): value is CustomerDeliveryAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Partial<CustomerDeliveryAddress>;
  return typeof address.id === "string"
    && (address.kind === "recent" || address.kind === "saved")
    && typeof address.recipientName === "string"
    && typeof address.recipientPhone === "string"
    && typeof address.premises === "string"
    && typeof address.locality === "string"
    && typeof address.riderNote === "string"
    && typeof address.deliveryPinLat === "number"
    && typeof address.deliveryPinLng === "number"
    && typeof address.locationSource === "string";
}
