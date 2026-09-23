import { publicSupabase, supabase } from "@/lib/supabase";

export type ShopCategoryMaster = {
  category_id: string;
  label: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

function isSchemaCacheError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST205"
    || /schema cache/i.test(error.message ?? "")
    || /shop_category_master/i.test(error.message ?? "");
}

async function fetchActiveShopCategories() {
  return publicSupabase
    .from("shop_category_master")
    .select("category_id,label,icon,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
}

export async function loadActiveShopCategories(): Promise<ShopCategoryMaster[]> {
  let result = await fetchActiveShopCategories();
  if (result.error && isSchemaCacheError(result.error)) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    result = await fetchActiveShopCategories();
  }
  if (result.error) throw result.error;
  return (result.data as ShopCategoryMaster[]) ?? [];
}

export async function loadAllShopCategories(): Promise<ShopCategoryMaster[]> {
  const { data, error } = await supabase
    .from("shop_category_master")
    .select("category_id,label,icon,sort_order,is_active")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw error;
  return (data as ShopCategoryMaster[]) ?? [];
}

export async function adminCreateShopCategory(input: {
  label: string;
  icon: string | null;
  sortOrder: number;
}) {
  const { error } = await supabase.rpc("fn_admin_create_shop_category", {
    p_label: input.label,
    p_icon: input.icon,
    p_sort_order: input.sortOrder,
  });
  if (error) throw error;
}

export async function adminUpdateShopCategory(input: {
  categoryId: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  const { error } = await supabase.rpc("fn_admin_update_shop_category", {
    p_category_id: input.categoryId,
    p_label: input.label,
    p_icon: input.icon,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
  });
  if (error) throw error;
}
