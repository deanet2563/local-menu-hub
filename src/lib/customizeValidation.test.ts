import { validateCustomizeSelections } from "@/lib/customizeValidation";

const requiredSingleGroup = {
  option_group_id: "group-1",
  name: "ระดับความเผ็ด",
  is_required: true,
  min_select: 1,
  max_select: 1,
};

const zeroSelected = validateCustomizeSelections([requiredSingleGroup], { "group-1": [] });
const exactlyOneSelected = validateCustomizeSelections([requiredSingleGroup], { "group-1": ["mild"] });
const overMaxSelected = validateCustomizeSelections([requiredSingleGroup], { "group-1": ["mild", "hot"] });
const optionalZeroSelected = validateCustomizeSelections([{ ...requiredSingleGroup, is_required: false, min_select: 0 }], { "group-1": [] });
const inactiveOption = validateCustomizeSelections([{ ...requiredSingleGroup, options: [{ option_id: "mild", option_group_id: "group-1", name: "mild", price_delta: 0, is_default: false, is_active: false, sort_order: 0 }] }], { "group-1": ["mild"] });

export const customizeValidationCompileChecks = {
  zeroSelectedRejected: zeroSelected.ok === false,
  exactlyOneAccepted: exactlyOneSelected.ok === true,
  overMaxRejected: overMaxSelected.ok === false,
  optionalZeroAccepted: optionalZeroSelected.ok === true,
  inactiveOptionRejected: inactiveOption.ok === false,
};
