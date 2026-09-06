import type { OrderingOptionGroup } from "@/lib/ordering-config";

export type CustomizeSelectionState = Record<string, string[]>;

export type CustomizeValidationResult =
  | { ok: true }
  | { ok: false; groupId: string; message: string };

type ValidatableCustomizeGroup = Pick<OrderingOptionGroup, "option_group_id" | "name" | "is_required" | "min_select" | "max_select"> & Partial<Pick<OrderingOptionGroup, "is_active" | "options">>;

export function minRequiredForGroup(group: Pick<OrderingOptionGroup, "is_required" | "min_select">): number {
  return group.is_required ? Math.max(1, Number(group.min_select) || 0) : Number(group.min_select) || 0;
}

export function validateCustomizeSelections(
  groups: ValidatableCustomizeGroup[],
  selected: CustomizeSelectionState,
): CustomizeValidationResult {
  for (const group of groups) {
    const count = selected[group.option_group_id]?.length ?? 0;
    if (group.is_active === false) {
      return { ok: false, groupId: group.option_group_id, message: `"${group.name}" ไม่พร้อมให้เลือก` };
    }
    const activeOptionIds = group.options ? new Set(group.options.filter((option) => option.is_active).map((option) => option.option_id)) : null;
    if (activeOptionIds && (selected[group.option_group_id] ?? []).some((optionId) => !activeOptionIds.has(optionId))) {
      return { ok: false, groupId: group.option_group_id, message: `ตัวเลือกใน "${group.name}" ไม่พร้อมให้เลือกแล้ว` };
    }
    const min = minRequiredForGroup(group);
    const max = Math.max(0, Number(group.max_select) || 0);
    if (count < min) {
      return {
        ok: false,
        groupId: group.option_group_id,
        message: min === max
          ? `กรุณาเลือก "${group.name}" ${min} รายการ`
          : `กรุณาเลือก "${group.name}" อย่างน้อย ${min} รายการ`,
      };
    }
    if (count > max) {
      return {
        ok: false,
        groupId: group.option_group_id,
        message: `เลือก "${group.name}" ได้ไม่เกิน ${max} รายการ`,
      };
    }
  }
  return { ok: true };
}
