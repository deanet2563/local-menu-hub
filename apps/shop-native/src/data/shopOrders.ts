import { supabase } from '../lib/supabase';
import type { ShopOrder } from '../domain/orders';
import { DASHBOARD_ORDER_SELECT, DETAIL_ORDER_SELECT, LEGACY_DETAIL_ORDER_SELECT } from './shopOrderSelects';

type PostgrestLikeError = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
};

function formatSupabaseError(context: string, error: PostgrestLikeError): Error {
  const message = [
    `[${context}] Supabase/PostgREST query failed`,
    error.code ? `code=${error.code}` : null,
    error.message ? `message=${error.message}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean).join(' ');
  return new Error(message, { cause: error });
}

function isMissingCustomerDeliveryCharge(error: PostgrestLikeError): boolean {
  return error.code === '42703' && /sub_orders\.customer_delivery_charge/.test(error.message ?? '');
}

function withLegacyDetailDefaults(order: ShopOrder | null): ShopOrder | null {
  if (!order) return null;
  return {
    ...order,
    customer_delivery_charge: 0,
  };
}

export async function getOwnedShopId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('shop_staff')
    .select('shop_id')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.shop_id ?? null;
}

export async function loadShopOrders(shopId: string): Promise<ShopOrder[]> {
  const { data, error } = await supabase
    .from('sub_orders')
    .select(DASHBOARD_ORDER_SELECT)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw formatSupabaseError('loadShopOrders', error);
  return (data as unknown as ShopOrder[]) ?? [];
}

export async function loadShopOrderById(subId: string): Promise<ShopOrder | null> {
  const { data, error } = await supabase
    .from('sub_orders')
    .select(DETAIL_ORDER_SELECT)
    .eq('sub_id', subId)
    .maybeSingle();

  if (error) {
    if (isMissingCustomerDeliveryCharge(error)) {
      console.warn(
        formatSupabaseError(
          'loadShopOrderById',
          error,
        ).message,
        'Required migration: supabase/migrations/20260904054500_shop_delivery_pricing.sql',
      );
      const fallback = await supabase
        .from('sub_orders')
        .select(LEGACY_DETAIL_ORDER_SELECT)
        .eq('sub_id', subId)
        .maybeSingle();
      if (fallback.error) throw formatSupabaseError('loadShopOrderById legacy fallback', fallback.error);
      return withLegacyDetailDefaults((fallback.data as unknown as ShopOrder | null) ?? null);
    }
    throw formatSupabaseError('loadShopOrderById', error);
  }
  return (data as unknown as ShopOrder | null) ?? null;
}
