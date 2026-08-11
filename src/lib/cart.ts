import { useSyncExternalStore } from "react";

// ============================================================
// MyTree — Cart v2
// - one shop per cart (existing behaviour preserved)
// - distinct cart lines for the same item with different options/notes
// - supports configurable sets/bundles
// - persists safely for LINE LIFF reload/navigation
// ============================================================

const STORAGE_KEY = "mytree_cart_v2";
const STORAGE_VERSION = 2;

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
  /** Unique cart-line identity. The same menu item can appear multiple times
   * when option selections or notes differ. */
  lineId: string;
  kind: "item" | "bundle";
  itemId: string;
  shopId: string;
  name: string;
  /** Base/menu price (or bundle price). Server remains authoritative. */
  price: number;
  imageUrl: string | null;
  qty: number;
  options: CartOptionSelection[];
  note: string | null;
  bundleSelections: CartBundleSelection[];
};

export type CartState = { shopId: string | null; items: CartItem[] };

type AddCartItem = {
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
};

type PersistedCart = { version: number; state: CartState };

const EMPTY: CartState = { shopId: null, items: [] };

function hasWindow() {
  return typeof window !== "undefined";
}

function normalizeOption(o: CartOptionSelection): CartOptionSelection {
  return { ...o, priceDelta: Number(o.priceDelta) || 0 };
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
  });
}

function makeLineId(item: AddCartItem): string {
  if (item.lineId) return item.lineId;
  // Simple items retain itemId as their lineId for backwards-compatible
  // setQty(itemId, qty) calls in existing ShopPage/HubHome code.
  const isSimple =
    (item.kind ?? "item") === "item" &&
    !(item.options?.length) &&
    !item.note?.trim() &&
    !(item.bundleSelections?.length);
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
  };
}

function restore(): CartState {
  if (!hasWindow()) return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as PersistedCart;
    if (parsed.version !== STORAGE_VERSION || !parsed.state || !Array.isArray(parsed.state.items)) return EMPTY;
    const items = parsed.state.items.filter((i) => i && i.shopId && i.itemId && i.qty > 0);
    const firstItem = items[0];
    const shopId = firstItem ? (parsed.state.shopId ?? firstItem.shopId) : null;
    // Single-shop safety also applies when restoring stale/tampered storage.
    const sameShop = shopId ? items.filter((i) => i.shopId === shopId) : [];
    return { shopId: sameShop.length ? shopId : null, items: sameShop };
  } catch {
    return EMPTY;
  }
}

let state: CartState = restore();
const listeners = new Set<() => void>();

function persist(next: CartState) {
  if (!hasWindow()) return;
  try {
    const payload: PersistedCart = { version: STORAGE_VERSION, state: next };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private/restricted webviews. Cart still
    // functions in-memory; persistence is an enhancement, not a hard gate.
  }
}

function set(next: CartState) {
  state = next;
  persist(next);
  listeners.forEach((l) => l());
}

export const cart = {
  /** Returns "ok" on success, or "different_shop" when a cart already belongs
   * to another shop. Caller must explicitly confirm before retrying force=true. */
  add(item: AddCartItem, opts?: { force?: boolean }): "ok" | "different_shop" {
    const switchingShop = !!state.shopId && state.shopId !== item.shopId;
    if (switchingShop && !opts?.force) return "different_shop";

    let items = switchingShop ? [] : state.items;
    const signature = stableLineSignature(item);
    const existing = items.find((i) => stableLineSignature(i) === signature);
    if (existing) {
      items = items.map((i) => (i.lineId === existing.lineId ? { ...i, qty: i.qty + 1 } : i));
    } else {
      items = [...items, normalizeItem(item)];
    }
    set({ shopId: item.shopId, items });
    return "ok";
  },

  /** Accepts lineId. For existing simple-item callers, itemId also works. */
  setQty(lineOrItemId: string, qty: number) {
    const exactLine = state.items.some((i) => i.lineId === lineOrItemId);
    const items = state.items
      .map((i) => {
        const match = exactLine ? i.lineId === lineOrItemId : i.itemId === lineOrItemId;
        return match ? { ...i, qty } : i;
      })
      .filter((i) => i.qty > 0);
    set({ shopId: items.length ? state.shopId : null, items });
  },

  remove(lineId: string) {
    const items = state.items.filter((i) => i.lineId !== lineId);
    set({ shopId: items.length ? state.shopId : null, items });
  },

  replaceLine(lineId: string, next: AddCartItem & { qty?: number }) {
    const current = state.items.find((i) => i.lineId === lineId);
    if (!current) return;
    if (next.shopId !== current.shopId) return;
    const replacement = normalizeItem({ ...next, lineId }, next.qty ?? current.qty);
    set({ ...state, items: state.items.map((i) => (i.lineId === lineId ? replacement : i)) });
  },

  clear() {
    set(EMPTY);
    if (hasWindow()) {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }
  },

  getState: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useCart(): CartState {
  return useSyncExternalStore(cart.subscribe, cart.getState, cart.getState);
}

export const cartLineUnitPrice = (i: CartItem) =>
  i.price + i.options.reduce((sum, o) => sum + o.priceDelta, 0);

export const cartLineTotal = (i: CartItem) => cartLineUnitPrice(i) * i.qty;

export const cartCount = (s: CartState) => s.items.reduce((n, i) => n + i.qty, 0);
export const cartTotal = (s: CartState) => s.items.reduce((n, i) => n + cartLineTotal(i), 0);
