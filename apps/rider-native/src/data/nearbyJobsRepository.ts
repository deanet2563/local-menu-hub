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
};

export type RiderV3AcceptResult = {
  ok: boolean;
  result: 'accepted' | 'already_accepted' | 'job_already_taken';
  subId: string;
  assignedRiderId?: string | null;
};

function config() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
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

export async function listNearbyDeliveryJobs(
  session: RiderSession,
  radiusKm = 1,
): Promise<NearbyDeliveryJob[]> {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/rpc/fn_rider_nearby_delivery_jobs`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ p_radius_km: radiusKm }),
  });

  if (!response.ok) {
    throw new Error(`nearby delivery lookup failed: ${response.status}`);
  }

  return (await response.json()) as NearbyDeliveryJob[];
}

export async function acceptDeliveryV3(
  session: RiderSession,
  subId: string,
): Promise<RiderV3AcceptResult> {
  const response = await fetch(`${workerUrl()}/rider/delivery/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subId }),
  });

  const payload = await response.json().catch(() => null) as RiderV3AcceptResult | { error?: string } | null;

  if (response.status === 409 && payload && 'result' in payload && payload.result === 'job_already_taken') {
    return payload as RiderV3AcceptResult;
  }

  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined;
    throw new Error(error || `Rider V3 accept failed: ${response.status}`);
  }

  return payload as RiderV3AcceptResult;
}
