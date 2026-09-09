import type { RiderSession } from '@/auth/session';

export type AssignedDelivery = {
  sub_id: string;
  shop_id: string;
  delivery_status: 'rider_called' | 'picked_up' | 'delivered' | 'failed' | string;
  delivery_address: string | null;
  delivery_photo_url: string | null;
  delivery_fee: number | null;
  delivery_distance_km: number | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  amount: number;
  created_at: string;
  shops: {
    name: string;
    phone: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  order_items: { item_name_snapshot: string; qty: number }[];
  hub_orders: { customers: { name: string | null; phone: string | null } | null } | null;
};

export type RiderV3PickupResult = {
  ok: boolean;
  result: 'picked_up' | 'already_picked_up';
  subId: string;
  assignedRiderId?: string | null;
};

export type RiderCancelReasonCode =
  | 'vehicle_problem'
  | 'accepted_by_mistake'
  | 'cannot_reach_shop'
  | 'emergency'
  | 'job_location_issue'
  | 'other';

export type RiderV3CancelResult = {
  ok: boolean;
  result: 'released';
  subId: string;
  shopId: string;
};

export type RiderCompletedDeliveryRow = {
  sub_id: string;
  delivery_fee: number | null;
  delivery_distance_km: number | null;
  delivered_at: string | null;
};

const SELECT = [
  'sub_id',
  'shop_id',
  'delivery_status',
  'delivery_address',
  'delivery_photo_url',
  'delivery_fee',
  'delivery_distance_km',
  'picked_up_at',
  'delivered_at',
  'amount',
  'created_at',
  'shops(name,phone,address,lat,lng)',
  'order_items(item_name_snapshot,qty)',
  'hub_orders(customers(name,phone))',
].join(',');

function config() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing Supabase public configuration');
  return { url: url.replace(/\/$/, ''), anonKey };
}

function workerUrl() {
  const url = process.env.EXPO_PUBLIC_MYTREE_WORKER_URL;
  if (!url) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');
  return url.replace(/\/$/, '');
}

function headers(session: RiderSession) {
  const { anonKey } = config();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function getActiveAssignedDelivery(session: RiderSession): Promise<AssignedDelivery | null> {
  const { url } = config();
  const query = new URLSearchParams({
    select: SELECT,
    delivery_status: 'in.(rider_called,picked_up)',
    order: 'created_at.asc',
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/sub_orders?${query.toString()}`, {
    headers: headers(session),
  });
  if (!response.ok) throw new Error(`assigned delivery lookup failed: ${response.status}`);
  const rows = (await response.json()) as AssignedDelivery[];
  return rows[0] ?? null;
}

export async function listRecentCompletedDeliveries(session: RiderSession, limit = 50): Promise<RiderCompletedDeliveryRow[]> {
  const { url } = config();
  const query = new URLSearchParams({
    select: 'sub_id,delivery_fee,delivery_distance_km,delivered_at',
    delivery_status: 'eq.delivered',
    delivered_at: 'not.is.null',
    order: 'delivered_at.desc',
    limit: String(limit),
  });

  const response = await fetch(`${url}/rest/v1/sub_orders?${query.toString()}`, {
    headers: headers(session),
  });
  if (!response.ok) throw new Error(`completed delivery lookup failed: ${response.status}`);
  return (await response.json()) as RiderCompletedDeliveryRow[];
}

export async function markDeliveryPickedUp(
  session: RiderSession,
  subId: string,
): Promise<RiderV3PickupResult> {
  const response = await fetch(`${workerUrl()}/rider/delivery/pickup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subId }),
  });

  const payload = await response.json().catch(() => null) as RiderV3PickupResult | { error?: string } | null;
  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined;
    throw new Error(error || `Rider V3 pickup failed: ${response.status}`);
  }

  return payload as RiderV3PickupResult;
}

export async function cancelAssignedDeliveryV3(
  session: RiderSession,
  subId: string,
  reasonCode: RiderCancelReasonCode,
  note?: string,
): Promise<RiderV3CancelResult> {
  const response = await fetch(`${workerUrl()}/rider/delivery/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subId, reasonCode, note: note?.trim() || undefined }),
  });

  const payload = await response.json().catch(() => null) as RiderV3CancelResult | { error?: string } | null;
  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined;
    throw new Error(error || `Rider V3 cancellation failed: ${response.status}`);
  }

  return payload as RiderV3CancelResult;
}
