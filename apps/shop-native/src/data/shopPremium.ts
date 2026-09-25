import { supabase } from '../lib/supabase';

export type ShopMembership = {
  shop_id: string;
  plan: 'free' | 'premium';
  status: 'active' | 'past_due' | 'cancelled' | 'expired';
  starts_at: string;
  ends_at: string | null;
};

export type ShopBadge = {
  badge_id: string;
  shop_id: string;
  badge_code: string;
  label: string;
  badge_source: string;
  icon_url: string | null;
  external_url: string | null;
  awarded_at: string;
  expires_at: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

export type ShopVerificationRequest = {
  request_id: string;
  shop_id: string;
  verification_type: 'mytree_verified';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
  merchant_note: string | null;
  admin_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
};

export async function loadShopPremiumState(shopId: string) {
  const [{ data: membership, error: membershipError }, { data: badges, error: badgeError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.from('shop_memberships').select('shop_id,plan,status,starts_at,ends_at').eq('shop_id', shopId).maybeSingle(),
    supabase.from('shop_badges').select('badge_id,shop_id,badge_code,label,badge_source,icon_url,external_url,awarded_at,expires_at,is_active,metadata').eq('shop_id', shopId).order('awarded_at', { ascending: false }),
    supabase.from('shop_verification_requests').select('request_id,shop_id,verification_type,status,merchant_note,admin_note,requested_at,reviewed_at').eq('shop_id', shopId).order('requested_at', { ascending: false }),
  ]);
  if (membershipError) throw membershipError;
  if (badgeError) throw badgeError;
  if (requestError) throw requestError;
  return {
    membership: (membership as ShopMembership | null) ?? null,
    badges: (badges as ShopBadge[] | null) ?? [],
    verificationRequests: (requests as ShopVerificationRequest[] | null) ?? [],
  };
}

export async function requestMyTreeVerification(shopId: string, note?: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_request_mytree_verification', {
    p_shop_id: shopId,
    p_note: note?.trim() || null,
  });
  if (error) {
    if (error.message.includes('premium_required_for_verification')) throw new Error('ต้องเป็นสมาชิก Premium ที่ใช้งานอยู่ก่อนจึงจะขอ MyTree Verified ได้');
    throw error;
  }
  return String(data);
}

export function hasActivePremium(membership: ShopMembership | null): boolean {
  if (!membership || membership.plan !== 'premium' || membership.status !== 'active') return false;
  return !membership.ends_at || new Date(membership.ends_at).getTime() > Date.now();
}

export function hasMyTreeVerified(badges: ShopBadge[]): boolean {
  return badges.some((badge) => badge.badge_code === 'mytree_verified' && badge.is_active && (!badge.expires_at || new Date(badge.expires_at).getTime() > Date.now()));
}
