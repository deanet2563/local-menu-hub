import { supabase } from '../lib/supabase';

export type ShopMenuItem = {
  item_id: string;
  shop_id: string;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
  is_available: boolean;
};

export type MenuCustomizeAssignment = {
  item_id: string;
  group_id: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
};

export async function loadShopMenuItems(shopId: string): Promise<ShopMenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('item_id,shop_id,name,price,category,image_url,is_available')
    .eq('shop_id', shopId)
    .order('category')
    .order('name');
  if (error) throw error;
  return (data as ShopMenuItem[] | null) ?? [];
}

export async function createShopMenuItem(input: {
  shopId: string;
  name: string;
  price: number;
  category: string | null;
  customizeGroupIds: string[];
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('กรุณากรอกชื่อเมนู');
  if (!Number.isFinite(input.price) || input.price <= 0) throw new Error('กรุณาใส่ราคาที่ถูกต้อง');

  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      shop_id: input.shopId,
      name,
      price: input.price,
      category: input.category?.trim() || null,
      is_available: true,
    })
    .select('item_id')
    .single();
  if (error) throw error;

  const itemId = (data as { item_id: string }).item_id;
  if (input.customizeGroupIds.length > 0) {
    const { error: assignmentError } = await supabase.from('menu_item_customize_groups').insert(
      input.customizeGroupIds.map((groupId, index) => ({
        item_id: itemId,
        group_id: groupId,
        is_required: false,
        min_select: 0,
        max_select: 1,
        sort_order: index,
      })),
    );
    if (assignmentError) throw assignmentError;
  }
  return itemId;
}

export async function updateShopMenuItem(itemId: string, patch: Partial<Pick<ShopMenuItem, 'name' | 'price' | 'category' | 'is_available'>>): Promise<void> {
  const next = { ...patch } as Record<string, unknown>;
  if (typeof patch.name === 'string') {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('ชื่อเมนูห้ามว่าง');
    next.name = trimmed;
  }
  if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price <= 0)) throw new Error('ราคาต้องมากกว่า 0');
  const { error } = await supabase.from('menu_items').update(next).eq('item_id', itemId);
  if (error) throw error;
}

export async function loadMenuCustomizeAssignments(itemId: string): Promise<MenuCustomizeAssignment[]> {
  const { data, error } = await supabase
    .from('menu_item_customize_groups')
    .select('item_id,group_id,is_required,min_select,max_select,sort_order')
    .eq('item_id', itemId)
    .order('sort_order');
  if (error) throw error;
  return (data as MenuCustomizeAssignment[] | null) ?? [];
}

export async function replaceMenuCustomizeAssignments(itemId: string, groupIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from('menu_item_customize_groups').delete().eq('item_id', itemId);
  if (deleteError) throw deleteError;
  if (groupIds.length === 0) return;
  const { error } = await supabase.from('menu_item_customize_groups').insert(
    groupIds.map((groupId, index) => ({ item_id: itemId, group_id: groupId, is_required: false, min_select: 0, max_select: 1, sort_order: index })),
  );
  if (error) throw error;
}
