import { buildCustomerReusableOptionGroups, mergeCustomerOptionGroups } from "@/lib/customer-item-options";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const groupId = "7dc2732d-0a6d-435d-82e9-b8540798a321";

const groups = [{
  group_id: groupId,
  shop_id: "shop",
  section_name: "Desserts",
  name: "Texture",
  sort_order: 0,
  is_active: true,
}];

const options = [
  {
    option_id: "381bfabf-b6a5-4a72-9e18-e7fe85088387",
    group_id: groupId,
    label: "Soft",
    price_delta: 0,
    sort_order: 0,
    is_active: true,
    is_default: true,
  },
  {
    option_id: "1c498dab-9d71-4ed7-9cbb-ce649c1f8636",
    group_id: groupId,
    label: "Crispy",
    price_delta: 0,
    sort_order: 1,
    is_active: true,
    is_default: false,
  },
  {
    option_id: "2f3e6d77-f7bb-49e6-b893-22b868ee2e99",
    group_id: groupId,
    label: "Medium",
    price_delta: 12.5,
    sort_order: 2,
    is_active: true,
    is_default: true,
  },
  {
    option_id: "6b269c45-0cc1-4df6-b251-3ff49ef2630a",
    group_id: groupId,
    label: "Inactive default",
    price_delta: 4,
    sort_order: 3,
    is_active: false,
    is_default: true,
  },
];

const required = buildCustomerReusableOptionGroups({
  links: [{
    group_id: groupId,
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
    group_id: groupId,
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
  mapsReusableLabels: required[0]?.options.map((option) => option.name).join(",") === "Soft,Crispy,Medium,Inactive default",
};

assertEqual(required[0]?.options[0]?.is_default, true, "canonical default option maps from DB");
assertEqual(required[0]?.options[1]?.is_default, false, "canonical non-default option maps from DB");
assertEqual(required[0]?.options[2]?.is_default, true, "multiple canonical defaults are preserved");
assertEqual(required[0]?.options[3]?.is_active, false, "inactive canonical option stays inactive");
assertEqual(required[0]?.options[3]?.is_default, true, "inactive default is preserved from DB, not inferred");
assertEqual(required[0]?.options[2]?.price_delta, 12.5, "canonical price_delta is preserved");

const noDefault = buildCustomerReusableOptionGroups({
  links: [{
    group_id: groupId,
    is_required: false,
    min_select: 0,
    max_select: 2,
    sort_order: 0,
  }],
  groups,
  options: options.map((option) => ({ ...option, is_default: false })),
});
assertEqual(noDefault[0]?.options.some((option) => option.is_default), false, "canonical defaults are not inferred client-side");

const legacyGroup = {
  option_group_id: "legacy-group",
  shop_id: "shop",
  name: "Legacy",
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
  name: "Texture",
  description: "Desserts",
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
