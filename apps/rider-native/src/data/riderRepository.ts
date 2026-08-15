import type { RiderSession } from '@/auth/session';
import type { RiderLocation } from '@/services/location';

export type RiderProfile = {
  id: string;
  customer_id: string;
  name: string;
  phone: string | null;
  vehicle_type: string | null;
  is_online: boolean;
  is_approved: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  deletion_requested_at: string | null;
  offers_delivery: boolean;
  lat: number | null;
  lng: number | null;
  location_updated_at: string | null;
};

const RIDER_SELECT = [
  'id',
  'customer_id',
  'name',
  'phone',
  'vehicle_type',
  'is_online',
  'is_approved',
  'is_banned',
  'banned_reason',
  'deletion_requested_at',
  'offers_delivery',
  'lat',
  'lng',
  'location_updated_at',
].join(',');

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

export async function getRiderProfile(session: RiderSession): Promise<RiderProfile | null> {
  const { url } = config();
  const query = new URLSearchParams({
    customer_id: `eq.${session.customerId}`,
    select: RIDER_SELECT,
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/riders?${query.toString()}`, {
    headers: headers(session),
  });

  if (!response.ok) throw new Error(`rider profile lookup failed: ${response.status}`);
  const rows = (await response.json()) as RiderProfile[];
  return rows[0] ?? null;
}

export async function setRiderOnline(
  session: RiderSession,
  rider: RiderProfile,
  isOnline: boolean,
  location?: RiderLocation,
) {
  if (isOnline) {
    if (!rider.is_approved) throw new Error('Rider is not approved');
    if (rider.is_banned) throw new Error('Rider is suspended');
    if (rider.deletion_requested_at) throw new Error('Rider deletion is pending');
    if (!rider.offers_delivery) throw new Error('Food delivery is not enabled');
    if (!location) throw new Error('Fresh location is required before going online');
  }

  const { url } = config();
  const payload: Record<string, unknown> = { is_online: isOnline };

  if (location) {
    payload.lat = location.lat;
    payload.lng = location.lng;
    payload.location_updated_at = location.capturedAt;
  }

  const response = await fetch(`${url}/rest/v1/riders?id=eq.${encodeURIComponent(rider.id)}`, {
    method: 'PATCH',
    headers: {
      ...headers(session),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`rider online update failed: ${response.status}`);
}

export async function updateRiderLocation(
  session: RiderSession,
  riderId: string,
  location: RiderLocation,
) {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/riders?id=eq.${encodeURIComponent(riderId)}`, {
    method: 'PATCH',
    headers: {
      ...headers(session),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      location_updated_at: location.capturedAt,
    }),
  });

  if (!response.ok) throw new Error(`rider location update failed: ${response.status}`);
}
