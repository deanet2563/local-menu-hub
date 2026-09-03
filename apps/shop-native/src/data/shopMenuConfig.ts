import { supabase } from '../lib/supabase';

export type ShopMenuCategory = {
  category_id: string;
  shop_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type ShopCustomizeOption = {
  option_id: string;
  group_id: string;
  label: string;
  price_delta: number;
  sort_order: number;
  is_active: boolean;
};

export type ShopCustomizeGroup = {
  group_id: string;
  shop_id: string;
  section_name: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  shop_customize_options: ShopCustomizeOption[];
};

export async function loadShopMenuCategories(shopId: string): Promise<ShopMenuCategory[]> {
  const { data, error } = await supabase
    .from('shop_menu_categories')
    .select('category_id,shop_id,name,sort_order,is_active')
    .eq('shop_id', shopId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data as ShopMenuCategory[] | null) ?? [];
}

export async function addShopMenuCategory(shopId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('กรุณากรอกชื่อหมวดหมู่');
  const { count, error: countError } = await supabase
    .from('shop_menu_categories')
    .select('category_id', { count: 'exact', head: true })
    .eq('shop_id', shopId);
  if (countError) throw countError;
  const { error } = await supabase.from('shop_menu_categories').insert({
    shop_id: shopId,
    name: trimmed,
    sort_order: count ?? 0,
    is_active: true,
  });
  if (error) throw error;
}

export async function setShopMenuCategoryActive(categoryId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_menu_categories').update({ is_active: active }).eq('category_id', categoryId);
  if (error) throw error;
}

export async function renameShopMenuCategory(categoryId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('กรุณากรอกชื่อหมวดหมู่');
  const { error } = await supabase.from('shop_menu_categories').update({ name: trimmed }).eq('category_id', categoryId);
  if (error) throw error;
}

export async function loadShopCustomizeGroups(shopId: string): Promise<ShopCustomizeGroup[]> {
  const { data, error } = await supabase
    .from('shop_customize_groups')
    .select('group_id,shop_id,section_name,name,sort_order,is_active,shop_customize_options(option_id,group_id,label,price_delta,sort_order,is_active)')
    .eq('shop_id', shopId)
    .order('section_name')
    .order('sort_order');
  if (error) throw error;
  return ((data as ShopCustomizeGroup[] | null) ?? []).map((group) => ({
    ...group,
    shop_customize_options: [...(group.shop_customize_options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function addCustomizeGroup(shopId: string, sectionName: string, name: string): Promise<void> {
  const section = sectionName.trim() || 'ทั่วไป';
  const groupName = name.trim();
  if (!groupName) throw new Error('กรุณากรอกชื่อชุดตัวเลือก');
  const { error } = await supabase.from('shop_customize_groups').insert({
    shop_id: shopId,
    section_name: section,
    name: groupName,
    is_active: true,
  });
  if (error) throw error;
}

export async function addCustomizeOption(groupId: string, label: string, priceDelta = 0): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('กรุณากรอกชื่อตัวเลือก');
  const { count, error: countError } = await supabase
    .from('shop_customize_options')
    .select('option_id', { count: 'exact', head: true })
    .eq('group_id', groupId);
  if (countError) throw countError;
  const { error } = await supabase.from('shop_customize_options').insert({
    group_id: groupId,
    label: trimmed,
    price_delta: Number.isFinite(priceDelta) ? priceDelta : 0,
    sort_order: count ?? 0,
    is_active: true,
  });
  if (error) throw error;
}

export async function setCustomizeGroupActive(groupId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_customize_groups').update({ is_active: active }).eq('group_id', groupId);
  if (error) throw error;
}

export async function setCustomizeOptionActive(optionId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_customize_options').update({ is_active: active }).eq('option_id', optionId);
  if (error) throw error;
}

export async function assignCustomizeGroupToMenuItem(itemId: string, groupId: string, required = false): Promise<void> {
  const { error } = await supabase.from('menu_item_customize_groups').upsert({
    item_id: itemId,
    group_id: groupId,
    is_required: required,
    min_select: required ? 1 : 0,
    max_select: 1,
  }, { onConflict: 'item_id,group_id' });
  if (error) throw error;
}

export async function removeCustomizeGroupFromMenuItem(itemId: string, groupId: string): Promise<void> {
  const { error } = await supabase
    .from('menu_item_customize_groups')
    .delete()
    .eq('item_id', itemId)
    .eq('group_id', groupId);
  if (error) throw error;
}
