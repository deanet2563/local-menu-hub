import { useSyncExternalStore } from "react";

// ============================================================
// MyTree — Cart v2
// - one shop per cart
// - distinct lines for different options / notes / customer-created sets
// - customer-created sets are grouping metadata, never fixed-price bundles
// - persists safely for LINE LIFF reload/navigation
// ============================================================

const STORAGE_KEY = "mytree_cart_v2";
const STORAGE_VERSION = 3;

export type CartOptionSelection = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

export type CartBundleSelection = {
  groupId: string;
  groupName: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPriceDelta?: number;
  options?: CartOptionSelection[];
  note?: string | null;
};

export type CartItem = {
  lineId: string;
  kind: "item" | "bundle";
  itemId: string;
  shopId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  qty: number;
  options: CartOptionSelection[];
  note: string | null;
  bundleSelections: CartBundleSelection[];
  /** Customer-created grouping such as ชุด 1 / ชุด 2. */
  setId: string | null;
  setName: string | null;
};

export type CartState = { shopId: string | null; items: CartItem[] };

export type AddCartItem = {
  lineId?: string;
  kind?: "item" | "bundle";
  itemId: string;
  shopId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  options?: CartOptionSelection[];
  note?: string | null;
  bundleSelections?: CartBundleSelection[];
  setId?: string | null;
  setName?: string | null;
};

type PersistedCart = { version: number; state: CartState };
const EMPTY: CartState = { shopId: null, items: [] };

function hasWindow() { return typeof window !== "undefined"; }
function normalizeOption(o: CartOptionSelection): CartOptionSelection { return { ...o, priceDelta: Number(o.priceDelta) || 0 }; }
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function nullableStringField(value: unknown): string | null {
  const text = stringField(value);
  return text || null;
}
function numberField(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}
function readPriceDelta(value: Record<string, unknown>): number {
  return numberField(value.priceDelta ?? value.price_delta);
}
function normalizeRestoredOption(value: unknown): CartOptionSelection | null {
  if (!isRecord(value)) return null;
  const optionId = stringField(value.optionId ?? value.option_id ?? value.id);
  if (!optionId) return null;
  const groupId = stringField(value.groupId ?? value.group_id);
  const optionName = stringField(value.optionName ?? value.option_name ?? value.name ?? value.label) || optionId;
  const groupName = stringField(value.groupName ?? value.group_name ?? value.sectionName ?? value.section_name) || groupId || "ตัวเลือก";
  return { groupId, groupName, optionId, optionName, priceDelta: readPriceDelta(value) };
}
function normalizeRestoredBundleSelection(value: unknown): CartBundleSelection | null {
  if (!isRecord(value)) return null;
  const itemId = stringField(value.itemId ?? value.item_id);
  const groupId = stringField(value.groupId ?? value.group_id);
  if (!itemId || !groupId) return null;
  const qty = Math.max(1, Math.trunc(numberField(value.qty, 1)));
  const options = Array.isArray(value.options)
    ? value.options.map(normalizeRestoredOption).filter((option): option is CartOptionSelection => Boolean(option))
    : [];
  return {
    groupId,
    groupName: stringField(value.groupName ?? value.group_name) || groupId,
    itemId,
    itemName: stringField(value.itemName ?? value.item_name ?? value.name) || itemId,
    qty,
    unitPriceDelta: value.unitPriceDelta === undefined && value.unit_price_delta === undefined
      ? undefined
      : numberField(value.unitPriceDelta ?? value.unit_price_delta),
    options,
    note: nullableStringField(value.note),
  };
}
function normalizeRestoredItem(value: unknown): CartItem | null {
  if (!isRecord(value)) return null;
  const itemId = stringField(value.itemId ?? value.item_id);
  const shopId = stringField(value.shopId ?? value.shop_id);
  if (!itemId || !shopId) return null;
  const qty = Math.trunc(numberField(value.qty));
  if (qty <= 0) return null;
  const options = Array.isArray(value.options)
    ? value.options.map(normalizeRestoredOption).filter((option): option is CartOptionSelection => Boolean(option))
    : [];
  const bundleSelections = Array.isArray(value.bundleSelections)
    ? value.bundleSelections.map(normalizeRestoredBundleSelection).filter((selection): selection is CartBundleSelection => Boolean(selection))
    : [];
  return {
    lineId: stringField(value.lineId ?? value.line_id) || itemId,
    kind: value.kind === "bundle" ? "bundle" : "item",
    itemId,
    shopId,
    name: stringField(value.name ?? value.itemName ?? value.item_name) || itemId,
    price: numberField(value.price),
    imageUrl: nullableStringField(value.imageUrl ?? value.image_url),
    qty,
    options,
    note: nullableStringField(value.note),
    bundleSelections,
    setId: nullableStringField(value.setId ?? value.set_id),
    setName: nullableStringField(value.setName ?? value.set_name),
  };
}

export function normalizeRestoredCartState(parsed: unknown): CartState {
  if (!isRecord(parsed) || ![2, STORAGE_VERSION].includes(numberField(parsed.version, -1))) return EMPTY;
  const state = isRecord(parsed.state) ? parsed.state : null;
  if (!state || !Array.isArray(state.items)) return EMPTY;
  const items = state.items.map(normalizeRestoredItem).filter((item): item is CartItem => Boolean(item));
  const firstItem = items[0];
  const preferredShop = stringField(state.shopId ?? state.shop_id);
  const shopId = preferredShop && items.some((i) => i.shopId === preferredShop)
    ? preferredShop
    : firstItem?.shopId ?? null;
  return { shopId, items };
}

function stableLineSignature(item: AddCartItem): string {
  const options = [...(item.options ?? [])]
    .map(normalizeOption)
    .sort((a, b) => `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`));
  const bundleSelections = [...(item.bundleSelections ?? [])]
    .map((s) => ({
      ...s,
      options: [...(s.options ?? [])].map(normalizeOption).sort((a, b) => `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`)),
    }))
    .sort((a, b) => `${a.groupId}:${a.itemId}:${a.itemName}`.localeCompare(`${b.groupId}:${b.itemId}:${b.itemName}`));
  return JSON.stringify({
    kind: item.kind ?? "item",
    itemId: item.itemId,
    options,
    note: item.note?.trim() || null,
    bundleSelections,
    setId: item.setId ?? null,
  });
}

function makeLineId(item: AddCartItem): string {
  if (item.lineId) return item.lineId;
  const isSimple =
    (item.kind ?? "item") === "item" &&
    !(item.options?.length) &&
    !item.note?.trim() &&
    !(item.bundleSelections?.length) &&
    !item.setId;
  if (isSimple) return item.itemId;
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${item.itemId}:${random}`;
}

function normalizeItem(item: AddCartItem, qty = 1): CartItem {
  return {
    lineId: makeLineId(item),
    kind: item.kind ?? "item",
    itemId: item.itemId,
    shopId: item.shopId,
    name: item.name,
    price: Number(item.price) || 0,
    imageUrl: item.imageUrl ?? null,
    qty,
    options: (item.options ?? []).map(normalizeOption),
    note: item.note?.trim() || null,
    bundleSelections: item.bundleSelections ?? [],
    setId: item.setId ?? null,
    setName: item.setName?.trim() || null,
  };
}

function restore(): CartState {
  if (!hasWindow()) return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return normalizeRestoredCartState(JSON.parse(raw));
  } catch { return EMPTY; }
}

let state: CartState = restore();
const listeners = new Set<() => void>();

function persist(next: CartState) {
  if (!hasWindow()) return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state: next } satisfies PersistedCart)); }
  catch { /* in-memory fallback */ }
}
function set(next: CartState) { state = next; persist(next); listeners.forEach((l) => l()); }

export const cart = {
  add(item: AddCartItem, opts?: { force?: boolean; allowMultipleShops?: boolean }): "ok" | "different_shop" {
    const switchingShop = !!state.shopId && state.shopId !== item.shopId;
    if (switchingShop && !opts?.force && !opts?.allowMultipleShops) return "different_shop";
    let items = switchingShop && opts?.force ? [] : state.items;
    const signature = stableLineSignature(item);
    const existing = items.find((i) => stableLineSignature(i) === signature);
    items = existing
      ? items.map((i) => i.lineId === existing.lineId ? { ...i, qty: i.qty + 1 } : i)
      : [...items, normalizeItem(item)];
    set({ shopId: state.shopId ?? item.shopId, items });
    return "ok";
  },
  setQty(lineOrItemId: string, qty: number) {
    const exactLine = state.items.some((i) => i.lineId === lineOrItemId);
    const items = state.items
      .map((i) => {
        const match = exactLine ? i.lineId === lineOrItemId : i.itemId === lineOrItemId;
        return match ? { ...i, qty } : i;
      })
      .filter((i) => i.qty > 0);
    const shopId = items.some((i) => i.shopId === state.shopId) ? state.shopId : items[0]?.shopId ?? null;
    set({ shopId, items });
  },
  selectShop(shopId: string) {
    if (state.items.some((item) => item.shopId === shopId)) set({ ...state, shopId });
  },
  clearShop(shopId: string) {
    const items = state.items.filter((item) => item.shopId !== shopId);
    const nextShopId = items.some((item) => item.shopId === state.shopId) ? state.shopId : items[0]?.shopId ?? null;
    set({ shopId: nextShopId, items });
  },
  remove(lineId: string) {
    const items = state.items.filter((i) => i.lineId !== lineId);
    set({ shopId: items.length ? state.shopId : null, items });
  },
  replaceLine(lineId: string, next: AddCartItem & { qty?: number }) {
    const current = state.items.find((i) => i.lineId === lineId);
    if (!current || next.shopId !== current.shopId) return;
    const replacement = normalizeItem({ ...next, lineId }, next.qty ?? current.qty);
    set({ ...state, items: state.items.map((i) => i.lineId === lineId ? replacement : i) });
  },
  clear() {
    set(EMPTY);
    if (hasWindow()) try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  },
  getState: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
};

export function useCart(): CartState { return useSyncExternalStore(cart.subscribe, cart.getState, cart.getState); }
export function groupCartItemsByShop(items: CartItem[]): Map<string, CartItem[]> {
  const grouped = new Map<string, CartItem[]>();
  for (const item of items) grouped.set(item.shopId, [...(grouped.get(item.shopId) ?? []), item]);
  return grouped;
}
export const cartLineUnitPrice = (i: CartItem) => i.price + i.options.reduce((sum, o) => sum + o.priceDelta, 0);
export const cartLineTotal = (i: CartItem) => cartLineUnitPrice(i) * i.qty;
export const cartCount = (s: CartState) => s.items.reduce((n, i) => n + i.qty, 0);
export const cartTotal = (s: CartState) => s.items.reduce((n, i) => n + cartLineTotal(i), 0);
