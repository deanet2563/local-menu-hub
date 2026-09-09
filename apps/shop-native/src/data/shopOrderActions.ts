import { getAccessToken } from '../lib/tokenStore';
import { supabase } from '../lib/supabase';

export type ShopCancelReasonCode = 'customer_requested' | 'order_cancelled' | 'shop_operational_issue' | 'other';
export type RiderReofferReasonCode = 'rider_not_arriving' | 'rider_too_slow' | 'cannot_contact_rider' | 'shop_operational_issue' | 'other';

function workerUrl() {
  return (process.env.EXPO_PUBLIC_MYTREE_WORKER_URL ?? '').replace(/\/$/, '');
}

async function shopAccessToken() {
  const token = await getAccessToken();
  if (!token) throw new Error('unauthorized_shop_session');
  return token;
}

async function postWorker<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await shopAccessToken();
  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `MyTree Worker request failed (${response.status})`);
  }
  return data;
}

export async function acceptShopOrder(subId: string): Promise<void> {
  await postWorker<{ ok: boolean }>('/shop/order/accept', { subId });
}

export async function requestShopDeliveryV3(subId: string): Promise<{
  result: 'offer_requested' | 'recently_requested';
  candidates?: number;
  usedRadiusKm?: number;
  pushed?: boolean;
}> {
  return postWorker('/shop/delivery/request', { subId });
}

export async function reofferShopDeliveryV3(
  subId: string,
  reasonCode: RiderReofferReasonCode,
  note?: string,
): Promise<{
  result: 'released' | 'already_released';
  offerResult?: 'offer_requested' | 'recently_requested';
  candidates?: number;
  usedRadiusKm?: number;
  pushed?: boolean;
}> {
  return postWorker('/shop/delivery/reoffer', { subId, reasonCode, note: note?.trim() || undefined });
}

export async function cancelShopDeliveryV3(
  subId: string,
  reasonCode: ShopCancelReasonCode,
  note?: string,
): Promise<'cancelled' | 'already_cancelled'> {
  const data = await postWorker<{
    ok: boolean;
    result: 'cancelled' | 'already_cancelled';
  }>('/shop/delivery/cancel', { subId, reasonCode, note: note?.trim() || undefined });
  return data.result;
}

export async function setShopOrderStatus(
  subId: string,
  nextStatus: 'preparing' | 'completed',
): Promise<void> {
  const allowedFrom = nextStatus === 'preparing' ? 'confirmed' : 'preparing';
  const { data, error } = await supabase
    .from('sub_orders')
    .update({ order_status: nextStatus })
    .eq('sub_id', subId)
    .eq('order_status', allowedFrom)
    .select('sub_id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Order can only move from ${allowedFrom} to ${nextStatus}`);
}

export async function confirmShopPayment(subId: string): Promise<void> {
  const { data, error } = await supabase
    .from('sub_orders')
    .update({ payment_status: 'paid' })
    .eq('sub_id', subId)
    .neq('payment_status', 'paid')
    .select('sub_id')
    .maybeSingle();
  if (error) throw error;
  // Already paid is idempotent and should not block Rider flow.
  if (!data) {
    const { data: current, error: currentError } = await supabase
      .from('sub_orders')
      .select('payment_status')
      .eq('sub_id', subId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (current?.payment_status !== 'paid') throw new Error('ยืนยันยอดไม่สำเร็จ');
  }
}

export async function completeShopOrderForRider(
  subId: string,
  currentStatus: string,
  paymentStatus: string,
): Promise<void> {
  if (paymentStatus !== 'paid') await confirmShopPayment(subId);

  let status = currentStatus;
  if (status === 'pending') {
    await acceptShopOrder(subId);
    status = 'confirmed';
  }
  if (status === 'confirmed') {
    await setShopOrderStatus(subId, 'preparing');
    status = 'preparing';
  }
  if (status === 'preparing') {
    await setShopOrderStatus(subId, 'completed');
    status = 'completed';
  }
  if (status !== 'completed') throw new Error('ออเดอร์ยังไม่พร้อมสำหรับเรียก Rider');
}

export async function confirmCompleteAndRequestRider(
  subId: string,
  currentStatus: string,
  paymentStatus: string,
) {
  await completeShopOrderForRider(subId, currentStatus, paymentStatus);
  return requestShopDeliveryV3(subId);
}
