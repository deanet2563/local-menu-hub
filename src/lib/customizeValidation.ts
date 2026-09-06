import type { OrderingOptionGroup } from "@/lib/ordering-config";

export type CustomizeSelectionState = Record<string, string[]>;

export type CustomizeValidationResult =
  | { ok: true }
  | { ok: false; groupId: string; message: string };

export function minRequiredForGroup(group: Pick<OrderingOptionGroup, "is_required" | "min_select">): number {
  return group.is_required ? Math.max(1, Number(group.min_select) || 0) : Number(group.min_select) || 0;
}

export function validateCustomizeSelections(
  groups: Array<Pick<OrderingOptionGroup, "option_group_id" | "name" | "is_required" | "min_select" | "max_select">>,
  selected: CustomizeSelectionState,
): CustomizeValidationResult {
  for (const group of groups) {
    const count = selected[group.option_group_id]?.length ?? 0;
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
