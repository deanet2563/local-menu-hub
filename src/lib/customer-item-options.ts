import { publicSupabase } from "@/lib/supabase";
import { loadItemOptionGroups, type OrderingOptionGroup } from "@/lib/ordering-config";

// Reusable Shop Customize is intentionally feature-gated until the production
// Worker order validator understands the same schema. This prevents a customer
// from selecting a new-schema option that the authoritative /order endpoint
// would reject. Legacy option groups remain fully available.
const REUSABLE_SHOP_CUSTOMIZE_ENABLED = import.meta.env.VITE_ENABLE_REUSABLE_SHOP_CUSTOMIZE === "true";
const CUSTOMER_STAGING_HOST = "customer-staging.local-menu-hub.pages.dev";

export function reusableShopCustomizeEnabled(): boolean {
  if (REUSABLE_SHOP_CUSTOMIZE_ENABLED) return true;
  return typeof window !== "undefined" && window.location.hostname === CUSTOMER_STAGING_HOST;
}

type ReusableCustomizeLink = {
  group_id: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
};

type ReusableCustomizeGroupRow = {
  group_id: string;
  shop_id: string;
  section_name: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type ReusableCustomizeOptionRow = {
  option_id: string;
  group_id: string;
  label: string;
  price_delta: number;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
};

export async function loadCustomerItemOptionGroups(itemId: string): Promise<OrderingOptionGroup[]> {
  const legacy = await loadItemOptionGroups(itemId).catch(() => [] as OrderingOptionGroup[]);
  if (!reusableShopCustomizeEnabled()) return legacy;

  const { data: links, error: linkError } = await publicSupabase
    .from("menu_item_customize_groups")
    .select("group_id,is_required,min_select,max_select,sort_order")
    .eq("item_id", itemId)
    .order("sort_order");
  if (linkError) throw linkError;

  const typedLinks = (links as ReusableCustomizeLink[] | null) ?? [];
  if (!typedLinks.length) return legacy;
  const ids = typedLinks.map((row) => row.group_id);

  const [{ data: groups, error: groupError }, { data: options, error: optionError }] = await Promise.all([
    publicSupabase
      .from("shop_customize_groups")
      .select("group_id,shop_id,section_name,name,sort_order,is_active")
      .in("group_id", ids)
      .eq("is_active", true),
    publicSupabase
      .from("shop_customize_options")
      .select("option_id,group_id,label,price_delta,sort_order,is_active,is_default")
      .in("group_id", ids)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (groupError) throw groupError;
  if (optionError) throw optionError;

  const reusable = buildCustomerReusableOptionGroups({
    links: typedLinks,
    groups: (groups as ReusableCustomizeGroupRow[] | null) ?? [],
    options: (options as ReusableCustomizeOptionRow[] | null) ?? [],
  });
  return mergeCustomerOptionGroups(legacy, reusable);
}

export function buildCustomerReusableOptionGroups(input: {
  links: ReusableCustomizeLink[];
  groups: ReusableCustomizeGroupRow[];
  options: ReusableCustomizeOptionRow[];
}): OrderingOptionGroup[] {
  const linkMap = new Map(input.links.map((row) => [row.group_id, row]));

  return input.groups
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
        options: input.options
          .filter((option) => option.group_id === group.group_id)
          .map((option) => ({
            option_id: option.option_id,
            option_group_id: option.group_id,
            name: option.label,
            price_delta: Number(option.price_delta) || 0,
            is_default: option.is_default,
            is_active: option.is_active,
            sort_order: option.sort_order,
          })),
      };
    })
    .filter((group): group is OrderingOptionGroup => Boolean(group))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function mergeCustomerOptionGroups(
  legacy: OrderingOptionGroup[],
  reusable: OrderingOptionGroup[],
): OrderingOptionGroup[] {
  const merged = new Map<string, OrderingOptionGroup>();
  for (const group of [...legacy, ...reusable]) merged.set(group.option_group_id, group);
  return [...merged.values()].sort((a, b) => a.sort_order - b.sort_order);
}
