import { buildCustomerReusableOptionGroups } from "@/lib/customer-item-options";

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
