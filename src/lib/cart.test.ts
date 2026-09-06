import { groupCartItemsByShop, type CartItem } from "@/lib/cart";

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
