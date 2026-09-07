import { validateCartLineCustomizeSelections } from "@/lib/cartCustomizeValidation";
import type { OrderingOptionGroup } from "@/lib/ordering-config";

const softnessGroup: OrderingOptionGroup = {
  option_group_id: "7dc2732d-0a6d-435d-82e9-b8540798a321",
  shop_id: "ร้านกุ๊ก-e41d",
  name: "ระดับความนิ่ม",
  description: "หมวด ขนมปัง",
  is_required: true,
  min_select: 1,
  max_select: 1,
  is_active: true,
  sort_order: 0,
  options: [
    {
      option_id: "381bfabf-b6a5-4a72-9e18-e7fe85088387",
      option_group_id: "7dc2732d-0a6d-435d-82e9-b8540798a321",
      name: "นิ่มมาก",
      price_delta: 0,
      is_default: false,
      is_active: true,
      sort_order: 0,
    },
  ],
};

const staleCartLine = {
  itemId: "b5216287-7bcc-413c-a009-98151c951e16",
  itemName: "ขนมปังหน้าเนย",
  options: [],
};

const customizedCartLine = {
  ...staleCartLine,
  options: [{
    groupId: "7dc2732d-0a6d-435d-82e9-b8540798a321",
    groupName: "ระดับความนิ่ม",
    optionId: "381bfabf-b6a5-4a72-9e18-e7fe85088387",
    optionName: "นิ่มมาก",
    priceDelta: 0,
  }],
};

const zeroSelected = validateCartLineCustomizeSelections(staleCartLine, [softnessGroup]);
const exactlyOneSelected = validateCartLineCustomizeSelections(customizedCartLine, [softnessGroup]);
const bundleChildMissing = validateCartLineCustomizeSelections({ ...staleCartLine, itemName: "bundle child" }, [softnessGroup]);

export const cartCustomizeValidationCompileChecks = {
  zeroSelectedRejected: zeroSelected.ok === false,
  exactlyOneAccepted: exactlyOneSelected.ok === true,
  bundleChildRejected: bundleChildMissing.ok === false,
};
