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
  add(item: Omit<CartItem, "qty">) {
    let items = state.items;
    if (state.shopId && state.shopId !== item.shopId) items = []; // switch shop -> reset
    const existing = items.find((i) => i.itemId === item.itemId);
    items = existing
      ? items.map((i) => (i.itemId === item.itemId ? { ...i, qty: i.qty + 1 } : i))
      : [...items, { ...item, qty: 1 }];
    set({ shopId: item.shopId, items });
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
