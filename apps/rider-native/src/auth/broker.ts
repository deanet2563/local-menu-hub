import { saveRiderSession, type RiderSession } from '@/auth/session';

type BrokerResponse = {
  access_token: string;
  expires_in: number;
  customer_id: string;
  refresh_token: string;
  refresh_expires_in: number;
};

const CLIENT_KIND = 'rider_native';

function workerUrl() {
  return (process.env.EXPO_PUBLIC_MYTREE_WORKER_URL ?? '').replace(/\/$/, '');
}

function toSession(data: BrokerResponse): RiderSession {
  if (!data.access_token || !data.customer_id || !data.expires_in || !data.refresh_token || !data.refresh_expires_in) {
    throw new Error('MyTree auth broker returned an invalid session');
  }

  const now = Math.floor(Date.now() / 1000);
  return {
    accessToken: data.access_token,
    customerId: data.customer_id,
    expiresAt: now + data.expires_in,
    refreshToken: data.refresh_token,
    refreshExpiresAt: now + data.refresh_expires_in,
  };
}

export async function exchangeLineIdToken(lineIdToken: string): Promise<RiderSession> {
  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');
  if (!lineIdToken) throw new Error('LINE ID token is required');

  const response = await fetch(`${baseUrl}/auth/line`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: lineIdToken, clientKind: CLIENT_KIND }),
  });

  if (!response.ok) {
    throw new Error(`MyTree auth broker failed: ${response.status}`);
  }

  const session = toSession((await response.json()) as BrokerResponse);
  await saveRiderSession(session);
  return session;
}

export async function refreshRiderSession(refreshToken: string): Promise<RiderSession> {
  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');
  if (!refreshToken) throw new Error('Refresh token is required');

  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, clientKind: CLIENT_KIND }),
  });

  if (!response.ok) {
    throw new Error(`MyTree Rider session refresh failed: ${response.status}`);
  }

  const session = toSession((await response.json()) as BrokerResponse);
  await saveRiderSession(session);
  return session;
}

export async function revokeRiderSession(refreshToken: string): Promise<void> {
  const baseUrl = workerUrl();
  if (!baseUrl || !refreshToken) return;

  const response = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, clientKind: CLIENT_KIND }),
  });

  if (!response.ok) {
    throw new Error(`MyTree Rider logout failed: ${response.status}`);
  }
}
