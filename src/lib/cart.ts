import { useSyncExternalStore } from "react";

// ============================================================
// MyTree — cart store (single-shop, in-memory)
// Cart holds items from ONE shop (sub_order = one shop). Adding from a
// different shop replaces the cart. Not persisted — checkout sends the
// order via liff.sendMessages() -> webhook -> fn_create_order.
// ============================================================

export type CartItem = {
  itemId: string;
  shopId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  qty: number;
};
export type CartState = { shopId: string | null; items: CartItem[] };

let state: CartState = { shopId: null, items: [] };
const listeners = new Set<() => void>();
function set(next: CartState) {
  state = next;
  listeners.forEach((l) => l());
}

export const cart = {
  /** Returns "ok" on success, or "different_shop" if this would silently wipe
   * items from another shop — caller should confirm with the user, then
   * retry with { force: true }. Fixes a bug where adding a dish from a
   * different shop (easy to do from the multi-shop food-first grid) silently
   * cleared the cart with no warning. */
  add(item: Omit<CartItem, "qty">, opts?: { force?: boolean }): "ok" | "different_shop" {
    const switchingShop = !!state.shopId && state.shopId !== item.shopId;
    if (switchingShop && !opts?.force) return "different_shop";

    let items = switchingShop ? [] : state.items;
    const existing = items.find((i) => i.itemId === item.itemId);
    items = existing
      ? items.map((i) => (i.itemId === item.itemId ? { ...i, qty: i.qty + 1 } : i))
      : [...items, { ...item, qty: 1 }];
    set({ shopId: item.shopId, items });
    return "ok";
  },
  setQty(itemId: string, qty: number) {
    const items = state.items
      .map((i) => (i.itemId === itemId ? { ...i, qty } : i))
      .filter((i) => i.qty > 0);
    set({ shopId: items.length ? state.shopId : null, items });
  },
  clear() {
    set({ shopId: null, items: [] });
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
export const cartCount = (s: CartState) => s.items.reduce((n, i) => n + i.qty, 0);
export const cartTotal = (s: CartState) => s.items.reduce((n, i) => n + i.qty * i.price, 0);
