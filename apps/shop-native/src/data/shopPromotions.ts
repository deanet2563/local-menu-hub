import { supabase } from '../lib/supabase';
import { getOwnedShopId } from './shopOrders';

export type ShopPromotion = {
  promotion_id: string;
  shop_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

const COLS = 'promotion_id,shop_id,title,description,banner_url,starts_at,ends_at,is_active,sort_order,created_at';

export async function loadOwnedShopPromotions(): Promise<ShopPromotion[]> {
  const shopId = await getOwnedShopId();
  if (!shopId) return [];
  const { data, error } = await supabase
    .from('shop_promotions')
    .select(COLS)
    .eq('shop_id', shopId)
    .order('sort_order')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ShopPromotion[] | null) ?? [];
}

export async function createShopPromotion(input: { title: string; description?: string | null; starts_at?: string | null; ends_at?: string | null }): Promise<void> {
  const shopId = await getOwnedShopId();
  if (!shopId) throw new Error('ไม่พบร้านของบัญชีนี้');
  const title = input.title.trim();
  if (!title) throw new Error('กรุณากรอกชื่อโปรโมชั่น');
  const { error } = await supabase.from('shop_promotions').insert({
    shop_id: shopId,
    title,
    description: input.description?.trim() || null,
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    is_active: true,
  });
  if (error) throw error;
}

export async function setShopPromotionActive(promotionId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('shop_promotions').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('promotion_id', promotionId);
  if (error) throw error;
}

export async function deleteShopPromotion(promotionId: string): Promise<void> {
  const { error } = await supabase.from('shop_promotions').delete().eq('promotion_id', promotionId);
  if (error) throw error;
}
