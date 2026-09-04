import { publicSupabase } from "@/lib/supabase";
import { loadItemOptionGroups, type OrderingOptionGroup } from "@/lib/ordering-config";

// Backward-compatible customer option loader.
// Existing menu option tables remain first priority; merchant-managed reusable
// customize groups are used when an item has no legacy option-group links.
export async function loadCustomerItemOptionGroups(itemId: string): Promise<OrderingOptionGroup[]> {
  const legacy = await loadItemOptionGroups(itemId).catch(() => [] as OrderingOptionGroup[]);
  if (legacy.length) return legacy;

  const { data: links, error: linkError } = await publicSupabase
    .from("menu_item_customize_groups")
    .select("group_id,is_required,min_select,max_select,sort_order")
    .eq("item_id", itemId)
    .order("sort_order");
  if (linkError) throw linkError;

  const typedLinks = (links as Array<{ group_id: string; is_required: boolean; min_select: number; max_select: number; sort_order: number }> | null) ?? [];
  if (!typedLinks.length) return [];
  const ids = typedLinks.map((row) => row.group_id);

  const [{ data: groups, error: groupError }, { data: options, error: optionError }] = await Promise.all([
    publicSupabase
      .from("shop_customize_groups")
      .select("group_id,shop_id,section_name,name,sort_order,is_active")
      .in("group_id", ids)
      .eq("is_active", true),
    publicSupabase
      .from("shop_customize_options")
      .select("option_id,group_id,label,price_delta,sort_order,is_active")
      .in("group_id", ids)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (groupError) throw groupError;
  if (optionError) throw optionError;

  const groupRows = (groups as Array<{ group_id: string; shop_id: string; section_name: string; name: string; sort_order: number; is_active: boolean }> | null) ?? [];
  const optionRows = (options as Array<{ option_id: string; group_id: string; label: string; price_delta: number; sort_order: number; is_active: boolean }> | null) ?? [];
  const linkMap = new Map(typedLinks.map((row) => [row.group_id, row]));

  return groupRows
    .map((group): OrderingOptionGroup | null => {
      const link = linkMap.get(group.group_id);
      if (!link) return null;
      return {
        option_group_id: group.group_id,
        shop_id: group.shop_id,
        name: group.name,
        description: group.section_name ? `หมวด ${group.section_name}` : null,
        min_select: link.min_select,
        max_select: link.max_select,
        is_required: link.is_required,
        is_active: group.is_active,
        sort_order: link.sort_order,
        options: optionRows
          .filter((option) => option.group_id === group.group_id)
          .map((option) => ({
            option_id: option.option_id,
            option_group_id: option.group_id,
            name: option.label,
            price_delta: Number(option.price_delta) || 0,
            is_default: false,
            is_active: option.is_active,
            sort_order: option.sort_order,
          })),
      };
    })
    .filter((group): group is OrderingOptionGroup => Boolean(group))
    .sort((a, b) => a.sort_order - b.sort_order);
}