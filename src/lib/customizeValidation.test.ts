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

export const customizeValidationCompileChecks = {
  zeroSelectedRejected: zeroSelected.ok === false,
  exactlyOneAccepted: exactlyOneSelected.ok === true,
  overMaxRejected: overMaxSelected.ok === false,
};
