import { supabase } from '../lib/supabase';

export type OwnedShopProfile = {
  shop_id: string;
  name: string;
  is_approved: boolean;
  is_banned: boolean;
  banned_reason: string | null;
};

export type RegisterShopInput = {
  name: string;
  category: string | null;
  phone: string | null;
  openTime: string | null;
  closeTime: string | null;
  openDays: string[];
  googleMapsLink: string | null;
  deliveryZone: string | null;
};

export async function getOwnedShopProfile(): Promise<OwnedShopProfile | null> {
  const { data: staff, error: staffError } = await supabase
    .from('shop_staff')
    .select('shop_id')
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (staffError) throw staffError;
  if (!staff?.shop_id) return null;

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('shop_id,name,is_approved,is_banned,banned_reason')
    .eq('shop_id', staff.shop_id)
    .maybeSingle();

  if (shopError) throw shopError;
  return (shop as OwnedShopProfile | null) ?? null;
}

export async function registerShop(input: RegisterShopInput): Promise<string | null> {
  const { data, error } = await supabase.rpc('fn_register_shop', {
    p_name: input.name.trim(),
    p_category: input.category,
    p_phone: input.phone,
    p_open_time: input.openTime,
    p_close_time: input.closeTime,
    p_open_days: input.openDays,
    p_google_maps_link: input.googleMapsLink,
    p_delivery_zone: input.deliveryZone,
    p_logo_url: null,
    p_lat: null,
    p_lng: null,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { shop_id?: string } | null)?.shop_id ?? null;
}
