import { Platform } from 'react-native';

import type { RiderSession } from '@/auth/session';

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

export async function registerPushDevice(
  session: RiderSession,
  riderId: string,
  expoPushToken: string,
) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Push device registration requires iOS or Android');
  }

  const { url } = config();
  const query = new URLSearchParams({ on_conflict: 'expo_push_token' });
  const response = await fetch(`${url}/rest/v1/rider_push_devices?${query.toString()}`, {
    method: 'POST',
    headers: {
      ...headers(session),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      rider_id: riderId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`push device registration failed: ${response.status}`);
  }
}

export async function disablePushDevice(
  session: RiderSession,
  expoPushToken: string,
) {
  const { url } = config();
  const query = new URLSearchParams({ expo_push_token: `eq.${expoPushToken}` });
  const response = await fetch(`${url}/rest/v1/rider_push_devices?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      ...headers(session),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      enabled: false,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`push device disable failed: ${response.status}`);
  }
}
