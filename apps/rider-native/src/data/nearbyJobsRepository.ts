import type { RiderSession } from '@/auth/session';

export type NearbyDeliveryJob = {
  sub_id: string;
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  shop_lat: number;
  shop_lng: number;
  distance_to_shop_km: number;
  confirmed_at: string | null;
  created_at?: string | null;
  delivery_address_preview?: string | null;
  delivery_distance_km?: number | null;
  delivery_fee?: number | null;
  delivery_fee_payer?: 'customer' | 'shop' | null;
};

export type DeliveryInterest = {
  id: string;
  sub_id: string;
  rider_id: string;
  distance_to_shop_km: number | null;
  status: 'interested' | 'selected' | 'not_selected' | 'withdrawn' | 'expired';
  interested_at: string;
  updated_at: string;
};

function config() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
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

async function callNearbyRpc(
  session: RiderSession,
  rpcName: string,
  radiusKm: number,
): Promise<Response> {
  const { url } = config();
  return fetch(`${url}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ p_radius_km: radiusKm }),
  });
}

export async function listNearbyDeliveryJobs(
  session: RiderSession,
  radiusKm = 1,
): Promise<NearbyDeliveryJob[]> {
  let response = await callNearbyRpc(session, 'fn_rider_nearby_delivery_jobs_v2', radiusKm);

  // Safe rollout: older production DBs can keep serving the proven V1 RPC
  // until the Rider Job V2 migration is applied.
  if (response.status === 404 || response.status === 400) {
    response = await callNearbyRpc(session, 'fn_rider_nearby_delivery_jobs', radiusKm);
  }

  if (!response.ok) {
    throw new Error(`nearby delivery lookup failed: ${response.status}`);
  }

  return (await response.json()) as NearbyDeliveryJob[];
}

export async function expressDeliveryInterest(
  session: RiderSession,
  subId: string,
): Promise<DeliveryInterest> {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/rpc/fn_rider_express_delivery_interest`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ p_sub_id: subId }),
  });

  if (!response.ok) {
    throw new Error(`delivery interest failed: ${response.status}`);
  }

  return (await response.json()) as DeliveryInterest;
}
