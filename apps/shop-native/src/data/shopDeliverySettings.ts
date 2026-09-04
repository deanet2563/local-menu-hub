import { supabase } from '../lib/supabase';

export type DeliveryPricingMode = 'distance' | 'flat' | 'free';

export type ShopDeliverySettings = {
  shop_id: string;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  service_area_note: string | null;
  delivery_pricing_mode: DeliveryPricingMode;
  delivery_flat_fee: number;
  free_delivery_min_order: number | null;
  rider_request_enabled: boolean;
};

type ShopDeliveryRow = {
  shop_id: string;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  service_area_note: string | null;
  customer_delivery_pricing_mode: DeliveryPricingMode;
  customer_delivery_flat_fee: number;
  customer_free_delivery_min_order: number | null;
  rider_request_enabled: boolean;
};

export async function getShopDeliverySettings(shopId: string): Promise<ShopDeliverySettings> {
  const { data, error } = await supabase
    .from('shops')
    .select('shop_id,pickup_enabled,delivery_enabled,service_area_note,customer_delivery_pricing_mode,customer_delivery_flat_fee,customer_free_delivery_min_order,rider_request_enabled')
    .eq('shop_id', shopId)
    .single();
  if (error) throw error;
  const row = data as ShopDeliveryRow;
  return {
    shop_id: row.shop_id,
    pickup_enabled: row.pickup_enabled,
    delivery_enabled: row.delivery_enabled,
    service_area_note: row.service_area_note,
    delivery_pricing_mode: row.customer_delivery_pricing_mode,
    delivery_flat_fee: Number(row.customer_delivery_flat_fee) || 0,
    free_delivery_min_order: row.customer_free_delivery_min_order == null ? null : Number(row.customer_free_delivery_min_order),
    rider_request_enabled: row.rider_request_enabled,
  };
}

export async function updateShopDeliverySettings(shopId: string, input: Omit<ShopDeliverySettings, 'shop_id'>): Promise<void> {
  if (input.delivery_flat_fee < 0) throw new Error('ค่าส่งต้องไม่ติดลบ');
  if (input.free_delivery_min_order !== null && input.free_delivery_min_order < 0) throw new Error('ยอดขั้นต่ำส่งฟรีต้องไม่ติดลบ');
  const { error } = await supabase.from('shops').update({
    pickup_enabled: input.pickup_enabled,
    delivery_enabled: input.delivery_enabled,
    service_area_note: input.service_area_note?.trim() || null,
    customer_delivery_pricing_mode: input.delivery_pricing_mode,
    customer_delivery_flat_fee: input.delivery_flat_fee,
    customer_free_delivery_min_order: input.free_delivery_min_order,
    rider_request_enabled: input.rider_request_enabled,
  }).eq('shop_id', shopId);
  if (error) throw error;
}

export function customerDeliveryFeePreview(settings: ShopDeliverySettings, subtotal: number, distanceFee = 0): number {
  if (!settings.delivery_enabled) return 0;
  if (settings.free_delivery_min_order !== null && subtotal >= settings.free_delivery_min_order) return 0;
  if (settings.delivery_pricing_mode === 'free') return 0;
  if (settings.delivery_pricing_mode === 'flat') return Math.max(0, Number(settings.delivery_flat_fee) || 0);
  return Math.max(0, Number(distanceFee) || 0);
}
