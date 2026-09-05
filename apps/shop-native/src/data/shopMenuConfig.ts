import { supabase } from '../lib/supabase';
import { formatSupabaseError, isMissingColumnError, isMissingTableError, logSupabaseError } from './supabaseError';
import { parseCustomizeOptionLabels } from './shopMenuConfigHelpers';

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
  category_id: string | null;
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
  if (error) {
    logSupabaseError('loadShopMenuCategories', error);
    throw new Error(formatSupabaseError(error, 'โหลดหมวดหมู่ไม่สำเร็จ'), { cause: error });
  }
  return (data as ShopMenuCategory[] | null) ?? [];
}

export async function loadShopMenuCategoriesForMenu(shopId: string): Promise<ShopMenuCategory[]> {
  try {
    return await loadShopMenuCategories(shopId);
  } catch (error) {
    if (/PGRST205/.test((error as Error).message)) {
      console.warn('[loadShopMenuCategoriesForMenu] setup category table is not live yet; menu will load without category chips');
      return [];
    }
    throw error;
  }
}

export async function addShopMenuCategory(shopId: string, name: string): Promise<ShopMenuCategory> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('กรุณากรอกชื่อหมวดหมู่');

  const { count, error: countError } = await supabase
    .from('shop_menu_categories')
    .select('category_id', { count: 'exact', head: true })
    .eq('shop_id', shopId);
  if (countError) {
    logSupabaseError('addShopMenuCategory.count', countError);
    throw new Error(formatSupabaseError(countError, 'เพิ่มหมวดหมู่ไม่สำเร็จ'), { cause: countError });
  }

  const { data, error } = await supabase.from('shop_menu_categories').insert({
    shop_id: shopId,
    name: trimmed,
    sort_order: count ?? 0,
    is_active: true,
  }).select('category_id,shop_id,name,sort_order,is_active').single();
  if (error) {
    logSupabaseError('addShopMenuCategory.insert', error);
    throw new Error(formatSupabaseError(error, 'เพิ่มหมวดหมู่ไม่สำเร็จ'), { cause: error });
  }
  return data as ShopMenuCategory;
}

export async function setShopMenuCategoryActive(categoryId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_menu_categories').update({ is_active: active }).eq('category_id', categoryId);
  if (error) {
    logSupabaseError('setShopMenuCategoryActive', error);
    throw new Error(formatSupabaseError(error, 'อัปเดตหมวดหมู่ไม่สำเร็จ'), { cause: error });
  }
}

export async function renameShopMenuCategory(categoryId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('กรุณากรอกชื่อหมวดหมู่');
  const { error } = await supabase.from('shop_menu_categories').update({ name: trimmed }).eq('category_id', categoryId);
  if (error) {
    logSupabaseError('renameShopMenuCategory', error);
    throw new Error(formatSupabaseError(error, 'แก้ไขหมวดหมู่ไม่สำเร็จ'), { cause: error });
  }
}

function normalizeCustomizeGroups(data: ShopCustomizeGroup[] | null): ShopCustomizeGroup[] {
  return (data ?? []).map((group) => ({
    ...group,
    category_id: group.category_id ?? null,
    shop_customize_options: [...(group.shop_customize_options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function loadShopCustomizeGroups(shopId: string): Promise<ShopCustomizeGroup[]> {
  const withCategory = await supabase
    .from('shop_customize_groups')
    .select('group_id,shop_id,category_id,section_name,name,sort_order,is_active,shop_customize_options(option_id,group_id,label,price_delta,sort_order,is_active)')
    .eq('shop_id', shopId)
    .order('sort_order')
    .order('name');

  if (!withCategory.error) return normalizeCustomizeGroups(withCategory.data as ShopCustomizeGroup[] | null);

  logSupabaseError('loadShopCustomizeGroups.withCategory', withCategory.error);
  if (isMissingColumnError(withCategory.error, 'category_id')) {
    const legacy = await supabase
      .from('shop_customize_groups')
      .select('group_id,shop_id,section_name,name,sort_order,is_active,shop_customize_options(option_id,group_id,label,price_delta,sort_order,is_active)')
      .eq('shop_id', shopId)
      .order('section_name')
      .order('sort_order');
    if (legacy.error) {
      logSupabaseError('loadShopCustomizeGroups.legacy', legacy.error);
      throw new Error(formatSupabaseError(legacy.error, 'โหลด Customize Option ไม่สำเร็จ'), { cause: legacy.error });
    }
    return normalizeCustomizeGroups(legacy.data as ShopCustomizeGroup[] | null);
  }

  if (isMissingTableError(withCategory.error, 'shop_customize_groups')) {
    throw new Error(formatSupabaseError(withCategory.error, 'ต้องอัปเดตฐานข้อมูล Customize ก่อนใช้งานหน้านี้'), { cause: withCategory.error });
  }
  throw new Error(formatSupabaseError(withCategory.error, 'โหลด Customize Option ไม่สำเร็จ'), { cause: withCategory.error });
}

export async function loadShopCustomizeGroupsForMenu(shopId: string): Promise<ShopCustomizeGroup[]> {
  try {
    return await loadShopCustomizeGroups(shopId);
  } catch (error) {
    if (/PGRST205/.test((error as Error).message)) {
      console.warn('[loadShopCustomizeGroupsForMenu] setup customize tables are not live yet; menu will load without customize chips');
      return [];
    }
    throw error;
  }
}

export async function addCustomizeGroup(shopId: string, categoryId: string, name: string, optionLabelsInput: string): Promise<void> {
  const groupName = name.trim();
  if (!categoryId) throw new Error('กรุณาเลือกหมวดหมู่สินค้า');
  if (!groupName) throw new Error('กรุณากรอกชื่อชุดตัวเลือก');
  const labels = parseCustomizeOptionLabels(optionLabelsInput);

  const { error } = await supabase.rpc('fn_create_shop_customize_group_with_options', {
    p_shop_id: shopId,
    p_category_id: categoryId,
    p_name: groupName,
    p_option_labels: labels,
  });
  if (error) {
    logSupabaseError('addCustomizeGroup.rpc', error);
    throw new Error(formatSupabaseError(error, 'เพิ่มชุดตัวเลือกไม่สำเร็จ'), { cause: error });
  }
}

export async function addCustomizeOption(groupId: string, label: string, priceDelta = 0): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('กรุณากรอกชื่อตัวเลือก');
  const { count, error: countError } = await supabase
    .from('shop_customize_options')
    .select('option_id', { count: 'exact', head: true })
    .eq('group_id', groupId);
  if (countError) {
    logSupabaseError('addCustomizeOption.count', countError);
    throw new Error(formatSupabaseError(countError, 'เพิ่มตัวเลือกไม่สำเร็จ'), { cause: countError });
  }
  const { error } = await supabase.from('shop_customize_options').insert({
    group_id: groupId,
    label: trimmed,
    price_delta: Number.isFinite(priceDelta) ? priceDelta : 0,
    sort_order: count ?? 0,
    is_active: true,
  });
  if (error) {
    logSupabaseError('addCustomizeOption.insert', error);
    throw new Error(formatSupabaseError(error, 'เพิ่มตัวเลือกไม่สำเร็จ'), { cause: error });
  }
}

export async function setCustomizeGroupActive(groupId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_customize_groups').update({ is_active: active }).eq('group_id', groupId);
  if (error) {
    logSupabaseError('setCustomizeGroupActive', error);
    throw new Error(formatSupabaseError(error, 'อัปเดตชุดตัวเลือกไม่สำเร็จ'), { cause: error });
  }
}

export async function setCustomizeOptionActive(optionId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_customize_options').update({ is_active: active }).eq('option_id', optionId);
  if (error) {
    logSupabaseError('setCustomizeOptionActive', error);
    throw new Error(formatSupabaseError(error, 'อัปเดตตัวเลือกไม่สำเร็จ'), { cause: error });
  }
}

export async function assignCustomizeGroupToMenuItem(itemId: string, groupId: string, required = false): Promise<void> {
  const { error } = await supabase.from('menu_item_customize_groups').upsert({
    item_id: itemId,
    group_id: groupId,
    is_required: required,
    min_select: required ? 1 : 0,
    max_select: 1,
  }, { onConflict: 'item_id,group_id' });
  if (error) {
    logSupabaseError('assignCustomizeGroupToMenuItem', error);
    throw new Error(formatSupabaseError(error, 'ผูกชุดตัวเลือกกับเมนูไม่สำเร็จ'), { cause: error });
  }
}

export async function removeCustomizeGroupFromMenuItem(itemId: string, groupId: string): Promise<void> {
  const { error } = await supabase
    .from('menu_item_customize_groups')
    .delete()
    .eq('item_id', itemId)
    .eq('group_id', groupId);
  if (error) {
    logSupabaseError('removeCustomizeGroupFromMenuItem', error);
    throw new Error(formatSupabaseError(error, 'ถอดชุดตัวเลือกจากเมนูไม่สำเร็จ'), { cause: error });
  }
}
