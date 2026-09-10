import { cartLineTotal, groupCartItemsByShop, normalizeRestoredCartState, type CartItem } from "@/lib/cart";

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

const restoredCustomizedBaoCart = normalizeRestoredCartState({
  version: 3,
  state: {
    shopId: "demo-a5-baobao-house",
    items: [{
      lineId: "8a500001-0000-4000-8000-000000000001:custom",
      kind: "item",
      itemId: "8a500001-0000-4000-8000-000000000001",
      shopId: "demo-a5-baobao-house",
      name: "ซาลาเปาหมูสับไข่ต้ม",
      price: 32,
      imageUrl: "/staging-demo/bao.svg",
      qty: 1,
      options: [
        {
          groupId: "8b500001-0000-4000-8000-000000000001",
          groupName: "เลือกไส้หลัก",
          optionId: "8b500002-0000-4000-8000-000000000002",
          name: "หมูแดง",
          price_delta: 5,
        },
        {
          group_id: "8b500001-0000-4000-8000-000000000002",
          group_name: "เพิ่มเครื่องเคียง",
          option_id: "8b500002-0000-4000-8000-000000000004",
          label: "ขนมจีบหมู 2 ชิ้น",
          priceDelta: 25,
        },
      ],
    }],
  },
});

const restoredBaoLine = restoredCustomizedBaoCart.items[0];
export const multiShopCartCompileChecks = {
  preservesShopBoundaries: grouped.get("shop-a")?.length === 2 && grouped.get("shop-b")?.length === 1,
  restoresCustomizedLineArrays: Array.isArray(restoredBaoLine?.options) && Array.isArray(restoredBaoLine?.bundleSelections),
  restoresLegacyOptionLabels: restoredBaoLine?.options.map((option) => `${option.groupName}: ${option.optionName}`).join(" · ") === "เลือกไส้หลัก: หมูแดง · เพิ่มเครื่องเคียง: ขนมจีบหมู 2 ชิ้น",
  restoresLegacyPriceDeltas: restoredBaoLine ? cartLineTotal(restoredBaoLine) === 62 : false,
};
