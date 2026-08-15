import type { RiderSession } from '@/auth/session';

export type AssignedDelivery = {
  sub_id: string;
  shop_id: string;
  delivery_status: 'rider_called' | 'picked_up' | 'delivered' | 'failed' | string;
  delivery_address: string | null;
  delivery_photo_url: string | null;
  amount: number;
  created_at: string;
  delivery_fee?: number | null;
  delivery_fee_payer?: 'customer' | 'shop' | null;
  delivery_distance_km?: number | null;
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

const SELECT = [
  'sub_id',
  'shop_id',
  'delivery_status',
  'delivery_address',
  'delivery_photo_url',
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
    order: 'created_at.desc',
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/sub_orders?${query.toString()}`, {
    headers: headers(session),
  });
  if (!response.ok) throw new Error(`assigned delivery lookup failed: ${response.status}`);
  const rows = (await response.json()) as AssignedDelivery[];
  return rows[0] ?? null;
}

export async function markDeliveryPickedUp(session: RiderSession, subId: string) {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/sub_orders?sub_id=eq.${encodeURIComponent(subId)}`, {
    method: 'PATCH',
    headers: { ...headers(session), Prefer: 'return=minimal' },
    body: JSON.stringify({ delivery_status: 'picked_up' }),
  });
  if (!response.ok) throw new Error(`pickup transition failed: ${response.status}`);
}
