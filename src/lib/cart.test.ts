import { cart, groupCartItemsByShop, type CartItem } from "@/lib/cart";

const line = (shopId: string, lineId: string): CartItem => ({
  shopId,
  lineId,
  kind: "item",
  itemId: lineId,
  name: lineId,
  price: 10,
  imageUrl: null,
  qty: 1,
  options: [],
  note: null,
  bundleSelections: [],
  setId: null,
  setName: null,
});

const grouped = groupCartItemsByShop([line("shop-a", "a"), line("shop-b", "b"), line("shop-a", "c")]);
export const multiShopCartCompileChecks = {
  preservesShopBoundaries: grouped.get("shop-a")?.length === 2 && grouped.get("shop-b")?.length === 1,
};

// Regression check for the add() force-switch bug: shopId must adopt the
// NEW shop, not linger on the shop that was just cleared out of the cart.
// (Relies on running from a fresh module load — hasWindow() is false in
// this context, so cart starts EMPTY — same assumption the check above makes.)
cart.add({ itemId: "x1", shopId: "shop-a", name: "x1", price: 10, imageUrl: null });
cart.add({ itemId: "y1", shopId: "shop-b", name: "y1", price: 10, imageUrl: null }, { force: true });
export const forceSwitchCartCompileChecks = {
  shopIdMatchesNewShopAfterForceSwitch: cart.getState().shopId === "shop-b",
  itemsOnlyContainNewShop: cart.getState().items.every((i) => i.shopId === "shop-b"),
};
