import { getAccessToken } from '../lib/tokenStore';
import { supabase } from '../lib/supabase';

function workerUrl() {
  return (process.env.EXPO_PUBLIC_MYTREE_WORKER_URL ?? '').replace(/\/$/, '');
}

export async function acceptShopOrder(subId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Shop session expired. Please sign in again.');

  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');

  const response = await fetch(`${baseUrl}/shop/order/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subId }),
  });

  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Accept order failed (${response.status})`);
  }
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
