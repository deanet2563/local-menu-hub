import { supabase } from '../lib/supabase';

export type ShopAssetKind = 'logo' | 'cover' | 'qr';

function shopStorageFolder(shopId: string): string {
  const bytes = new TextEncoder().encode(shopId);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `shop-${hex}`;
}

function extensionFromAsset(uri: string, mimeType?: string | null, fileName?: string | null): string {
  const raw = fileName?.split('.').pop()?.toLowerCase() || uri.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
  if (/^(jpg|jpeg|png|webp)$/.test(raw)) return raw === 'jpeg' ? 'jpg' : raw;
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadShopAsset(input: {
  shopId: string;
  kind: ShopAssetKind;
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<string> {
  const response = await fetch(input.uri);
  if (!response.ok) throw new Error('อ่านไฟล์รูปจากอุปกรณ์ไม่สำเร็จ');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('ไฟล์รูปว่างเปล่า');
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('ไฟล์รูปต้องไม่เกิน 8 MB');

  const ext = extensionFromAsset(input.uri, input.mimeType, input.fileName);
  const contentType = input.mimeType || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  const folder = shopStorageFolder(input.shopId);
  const bucket = input.kind === 'qr' ? 'shop-qr-codes' : 'shop-assets';
  const path = `${folder}/${input.kind === 'qr' ? 'qr' : input.kind}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  const column = input.kind === 'logo' ? 'logo_url' : input.kind === 'cover' ? 'cover_url' : 'qr_code_url';
  const { error: updateError } = await supabase.from('shops').update({ [column]: publicUrl }).eq('shop_id', input.shopId);
  if (updateError) throw updateError;
  return publicUrl;
}
