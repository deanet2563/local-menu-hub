import { supabase } from '../lib/supabase';
import type { ShopOrder } from '../domain/orders';

const ORDER_SELECT = [
  'sub_id',
  'order_id',
  'fulfillment_type',
  'order_status',
  'payment_status',
  'delivery_status',
  'payment_method',
  'payment_slip_url',
  'customer_note',
  'delivery_address',
  'amount',
  'assigned_rider_id',
  'created_at',
  'requested_for',
  'delivery_fee',
  'delivery_fee_payer',
  'delivery_distance_km',
  'order_items(item_name_snapshot,qty,line_total)',
  'hub_orders(customers(name,phone))',
].join(',');

export async function getOwnedShopId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('shop_staff')
    .select('shop_id')
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.shop_id ?? null;
}

export async function loadShopOrders(shopId: string): Promise<ShopOrder[]> {
  const { data, error } = await supabase
    .from('sub_orders')
    .select(ORDER_SELECT)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as ShopOrder[]) ?? [];
}

export async function loadShopOrderById(subId: string): Promise<ShopOrder | null> {
  const { data, error } = await supabase
    .from('sub_orders')
    .select(ORDER_SELECT)
    .eq('sub_id', subId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ShopOrder | null) ?? null;
}
