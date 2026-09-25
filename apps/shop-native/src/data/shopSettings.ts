import { supabase } from '../lib/supabase';
import { formatSupabaseError, logSupabaseError } from './supabaseError';

export type ShopHours = Record<string, { open?: string; close?: string; closed?: boolean }>;

export type ShopSettings = {
  shop_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  qr_code_url: string | null;
  google_maps_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  line_url: string | null;
  village: string | null;
  zone: string | null;
  soi: string | null;
  lat: number | null;
  lng: number | null;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  service_area_note: string | null;
  payment_cash_enabled: boolean;
  payment_qr_enabled: boolean;
  business_hours: ShopHours | null;
};

export type ShopSettingsPatch = Omit<ShopSettings, 'shop_id' | 'logo_url' | 'cover_url' | 'qr_code_url'>;

const COLS = 'shop_id,name,phone,email,address,description,logo_url,cover_url,qr_code_url,google_maps_url,website_url,facebook_url,instagram_url,tiktok_url,line_url,village,zone,soi,lat,lng,pickup_enabled,delivery_enabled,service_area_note,payment_cash_enabled,payment_qr_enabled,business_hours';

export async function getOwnedShopSettings(): Promise<ShopSettings | null> {
  const { data: staff, error: staffError } = await supabase
    .from('shop_staff')
    .select('shop_id')
    .limit(1)
    .maybeSingle();
  if (staffError) {
    logSupabaseError('getOwnedShopSettings.staff', staffError);
    throw new Error(formatSupabaseError(staffError, 'โหลดสิทธิ์ร้านไม่สำเร็จ'));
  }
  if (!staff?.shop_id) return null;

  const { data, error } = await supabase.from('shops').select(COLS).eq('shop_id', staff.shop_id).maybeSingle();
  if (error) {
    logSupabaseError('getOwnedShopSettings.shop', error);
    throw new Error(formatSupabaseError(error, 'โหลดข้อมูลร้านไม่สำเร็จ'));
  }
  return (data as ShopSettings | null) ?? null;
}

export async function updateShopSettings(shopId: string, patch: ShopSettingsPatch): Promise<void> {
  const { error } = await supabase.from('shops').update(patch).eq('shop_id', shopId);
  if (error) {
    logSupabaseError('updateShopSettings', error);
    throw new Error(formatSupabaseError(error, 'บันทึกข้อมูลร้านไม่สำเร็จ'));
  }
}
