import { buildCustomerReusableOptionGroups, mergeCustomerOptionGroups } from "@/lib/customer-item-options";

const groups = [{
  group_id: "7dc2732d-0a6d-435d-82e9-b8540798a321",
  shop_id: "ร้านกุ๊ก-e41d",
  section_name: "ขนมปัง",
  name: "ระดับความนิ่ม",
  sort_order: 0,
  is_active: true,
}];

const options = [
  {
    option_id: "381bfabf-b6a5-4a72-9e18-e7fe85088387",
    group_id: "7dc2732d-0a6d-435d-82e9-b8540798a321",
    label: "นิ่มมาก",
    price_delta: 0,
    sort_order: 0,
    is_active: true,
  },
  {
    option_id: "1c498dab-9d71-4ed7-9cbb-ce649c1f8636",
    group_id: "7dc2732d-0a6d-435d-82e9-b8540798a321",
    label: "นิ่มน้อย",
    price_delta: 0,
    sort_order: 1,
    is_active: true,
  },
];

const required = buildCustomerReusableOptionGroups({
  links: [{
    group_id: "7dc2732d-0a6d-435d-82e9-b8540798a321",
    is_required: true,
    min_select: 1,
    max_select: 1,
    sort_order: 0,
  }],
  groups,
  options,
});

const optional = buildCustomerReusableOptionGroups({
  links: [{
    group_id: "7dc2732d-0a6d-435d-82e9-b8540798a321",
    is_required: false,
    min_select: 0,
    max_select: 1,
    sort_order: 0,
  }],
  groups,
  options,
});

export const customerItemOptionsCompileChecks = {
  preservesRequiredAssignment: required[0]?.is_required === true && required[0]?.min_select === 1,
  preservesOptionalAssignment: optional[0]?.is_required === false && optional[0]?.min_select === 0,
  mapsReusableLabels: required[0]?.options.map((option) => option.name).join(",") === "นิ่มมาก,นิ่มน้อย",
};

const legacyGroup = {
  option_group_id: "legacy-group",
  shop_id: "shop",
  name: "โน้ตเพิ่มเติม",
  description: null,
  min_select: 0,
  max_select: 1,
  is_required: false,
  is_active: true,
  sort_order: 1,
  options: [],
};

const requiredReusableGroup = {
  option_group_id: "reusable-required-group",
  shop_id: "shop",
  name: "ระดับความนิ่ม",
  description: "หมวด ขนมปัง",
  min_select: 1,
  max_select: 1,
  is_required: true,
  is_active: true,
  sort_order: 2,
  options: [],
};

const mixed = mergeCustomerOptionGroups([legacyGroup], [requiredReusableGroup]);
export const mixedCustomizeCompileChecks = {
  preservesLegacyGroup: mixed.some((group) => group.option_group_id === "legacy-group"),
  preservesRequiredReusableGroup: mixed.some((group) => group.is_required && group.min_select === 1 && group.max_select === 1),
};
