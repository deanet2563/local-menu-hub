import { supabase } from "@/lib/supabase";

export type OrderingOption = {
  option_id: string;
  option_group_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

export type OrderingOptionGroup = {
  option_group_id: string;
  shop_id: string;
  name: string;
  description: string | null;
  min_select: number;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  options: OrderingOption[];
};

export type BundleEligibleItem = {
  item_id: string;
  name: string;
  image_url: string | null;
  base_price: number;
  price_delta: number;
  is_available: boolean;
};

export type OrderingBundleGroup = {
  bundle_group_id: string;
  name: string;
  min_units: number;
  max_units: number;
  sort_order: number;
  items: BundleEligibleItem[];
};

export type OrderingBundle = {
  bundle_id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
  sort_order: number;
  groups: OrderingBundleGroup[];
  optionGroups: OrderingOptionGroup[];
};

export async function loadItemOptionGroups(itemId: string): Promise<OrderingOptionGroup[]> {
  const { data: links, error: linkError } = await supabase
    .from("menu_item_option_groups")
    .select("option_group_id,sort_order")
    .eq("item_id", itemId)
    .order("sort_order");
  if (linkError) throw linkError;

  const ids = ((links as { option_group_id: string; sort_order: number }[]) ?? []).map((x) => x.option_group_id);
  if (!ids.length) return [];

  const [{ data: groups, error: groupError }, { data: options, error: optionError }] = await Promise.all([
    supabase
      .from("menu_option_groups")
      .select("option_group_id,shop_id,name,description,min_select,max_select,is_required,is_active,sort_order")
      .in("option_group_id", ids)
      .eq("is_active", true),
    supabase
      .from("menu_options")
      .select("option_id,option_group_id,name,price_delta,is_default,is_active,sort_order")
      .in("option_group_id", ids)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (groupError) throw groupError;
  if (optionError) throw optionError;

  const linkOrder = new Map(((links as { option_group_id: string; sort_order: number }[]) ?? []).map((l) => [l.option_group_id, l.sort_order]));
  const opts = (options as OrderingOption[]) ?? [];
  return ((groups as Omit<OrderingOptionGroup, "options">[]) ?? [])
    .map((g) => ({ ...g, options: opts.filter((o) => o.option_group_id === g.option_group_id) }))
    .sort((a, b) => (linkOrder.get(a.option_group_id) ?? a.sort_order) - (linkOrder.get(b.option_group_id) ?? b.sort_order));
}

export async function loadShopBundles(shopId: string): Promise<OrderingBundle[]> {
  const { data: bundles, error: bundleError } = await supabase
    .from("menu_bundles")
    .select("bundle_id,shop_id,name,description,price,image_url,category,is_available,sort_order")
    .eq("shop_id", shopId)
    .eq("is_available", true)
    .order("sort_order");
  if (bundleError) throw bundleError;

  const bs = (bundles as Omit<OrderingBundle, "groups" | "optionGroups">[]) ?? [];
  if (!bs.length) return [];
  const bundleIds = bs.map((b) => b.bundle_id);

  const [{ data: groups, error: groupError }, { data: optionLinks, error: optionLinkError }] = await Promise.all([
    supabase
      .from("menu_bundle_groups")
      .select("bundle_group_id,bundle_id,name,min_units,max_units,sort_order")
      .in("bundle_id", bundleIds)
      .order("sort_order"),
    supabase
      .from("menu_bundle_option_groups")
      .select("bundle_id,option_group_id,sort_order")
      .in("bundle_id", bundleIds)
      .order("sort_order"),
  ]);
  if (groupError) throw groupError;
  if (optionLinkError) throw optionLinkError;

  const gs = (groups as { bundle_group_id: string; bundle_id: string; name: string; min_units: number; max_units: number; sort_order: number }[]) ?? [];
  const groupIds = gs.map((g) => g.bundle_group_id);
  const optionGroupIds = Array.from(new Set(((optionLinks as { option_group_id: string }[]) ?? []).map((x) => x.option_group_id)));

  const [eligibleResult, optionGroupResult, optionResult] = await Promise.all([
    groupIds.length
      ? supabase
          .from("menu_bundle_group_items")
          .select("bundle_group_id,item_id,price_delta,sort_order,menu_items(name,price,image_url,is_available)")
          .in("bundle_group_id", groupIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    optionGroupIds.length
      ? supabase
          .from("menu_option_groups")
          .select("option_group_id,shop_id,name,description,min_select,max_select,is_required,is_active,sort_order")
          .in("option_group_id", optionGroupIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    optionGroupIds.length
      ? supabase
          .from("menu_options")
          .select("option_id,option_group_id,name,price_delta,is_default,is_active,sort_order")
          .in("option_group_id", optionGroupIds)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (eligibleResult.error) throw eligibleResult.error;
  if (optionGroupResult.error) throw optionGroupResult.error;
  if (optionResult.error) throw optionResult.error;

  const eligibleRows = (eligibleResult.data as unknown as {
    bundle_group_id: string;
    item_id: string;
    price_delta: number;
    sort_order: number;
    menu_items: { name: string; price: number; image_url: string | null; is_available: boolean } | null;
  }[]) ?? [];

  const ogs = (optionGroupResult.data as Omit<OrderingOptionGroup, "options">[]) ?? [];
  const os = (optionResult.data as OrderingOption[]) ?? [];
  const optionGroups = ogs.map((g) => ({ ...g, options: os.filter((o) => o.option_group_id === g.option_group_id) }));
  const bundleOptionLinks = (optionLinks as { bundle_id: string; option_group_id: string; sort_order: number }[]) ?? [];

  return bs.map((b) => ({
    ...b,
    groups: gs
      .filter((g) => g.bundle_id === b.bundle_id)
      .map((g) => ({
        bundle_group_id: g.bundle_group_id,
        name: g.name,
        min_units: g.min_units,
        max_units: g.max_units,
        sort_order: g.sort_order,
        items: eligibleRows
          .filter((r) => r.bundle_group_id === g.bundle_group_id && r.menu_items?.is_available)
          .map((r) => ({
            item_id: r.item_id,
            name: r.menu_items?.name ?? "",
            image_url: r.menu_items?.image_url ?? null,
            base_price: Number(r.menu_items?.price ?? 0),
            price_delta: Number(r.price_delta) || 0,
            is_available: !!r.menu_items?.is_available,
          })),
      })),
    optionGroups: bundleOptionLinks
      .filter((l) => l.bundle_id === b.bundle_id)
      .sort((a, z) => a.sort_order - z.sort_order)
      .map((l) => optionGroups.find((g) => g.option_group_id === l.option_group_id))
      .filter(Boolean) as OrderingOptionGroup[],
  }));
}
