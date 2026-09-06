import type { CartBundleSelection, CartItem, CartOptionSelection } from "@/lib/cart";
import { loadCustomerItemOptionGroups } from "@/lib/customer-item-options";
import type { OrderingOptionGroup } from "@/lib/ordering-config";
import { validateCustomizeSelections } from "@/lib/customizeValidation";

type ConfigurableLine = {
  itemId: string;
  itemName: string;
  options: CartOptionSelection[];
};

export type CartCustomizeValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function selectedByGroup(options: CartOptionSelection[]): Record<string, string[]> {
  const selected: Record<string, string[]> = {};
  for (const option of options) {
    selected[option.groupId] = [...(selected[option.groupId] ?? []), option.optionId];
  }
  return selected;
}

function configurableLines(items: CartItem[]): ConfigurableLine[] {
  const lines: ConfigurableLine[] = [];
  for (const item of items) {
    if (item.kind === "item") {
      lines.push({ itemId: item.itemId, itemName: item.name, options: item.options });
    }
    for (const child of item.bundleSelections) {
      lines.push(configurableLineFromBundleSelection(child));
    }
  }
  return lines;
}

function configurableLineFromBundleSelection(selection: CartBundleSelection): ConfigurableLine {
  return {
    itemId: selection.itemId,
    itemName: selection.itemName,
    options: selection.options ?? [],
  };
}

export function validateCartLineCustomizeSelections(
  line: ConfigurableLine,
  groups: OrderingOptionGroup[],
): CartCustomizeValidationResult {
  const validation = validateCustomizeSelections(groups, selectedByGroup(line.options));
  if (validation.ok) return validation;
  return {
    ok: false,
    message: `${line.itemName}: ${validation.message}`,
  };
}

export async function validateCartCustomizeRequirements(items: CartItem[]): Promise<CartCustomizeValidationResult> {
  const cache = new Map<string, Promise<OrderingOptionGroup[]>>();
  for (const line of configurableLines(items)) {
    const groupsPromise = cache.get(line.itemId) ?? loadCustomerItemOptionGroups(line.itemId);
    cache.set(line.itemId, groupsPromise);
    const groups = await groupsPromise;
    const validation = validateCartLineCustomizeSelections(line, groups);
    if (!validation.ok) return validation;
  }
  return { ok: true };
}
