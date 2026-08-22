import { saveShopSession, type ShopSession } from './session';

type BrokerResponse = {
  access_token: string;
  expires_in: number;
  customer_id: string;
  refresh_token: string;
  refresh_expires_in: number;
};

function workerUrl() {
  return (process.env.EXPO_PUBLIC_MYTREE_WORKER_URL ?? '').replace(/\/$/, '');
}

function toSession(data: BrokerResponse, lineIdToken?: string): ShopSession {
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
    lineIdToken,
  };
}

export async function exchangeLineIdToken(lineIdToken: string): Promise<ShopSession> {
  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');
  if (!lineIdToken) throw new Error('LINE ID token is required');

  const response = await fetch(`${baseUrl}/auth/line`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: lineIdToken }),
  });

  if (!response.ok) {
    throw new Error(`MyTree auth broker failed: ${response.status}`);
  }

  const session = toSession((await response.json()) as BrokerResponse, lineIdToken);
  await saveShopSession(session);
  return session;
}

export async function refreshShopSession(refreshToken: string, lineIdToken?: string): Promise<ShopSession> {
  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');

  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    throw new Error(`MyTree session refresh failed: ${response.status}`);
  }

  const session = toSession((await response.json()) as BrokerResponse, lineIdToken);
  await saveShopSession(session);
  return session;
}

export async function revokeShopSession(refreshToken: string): Promise<void> {
  const baseUrl = workerUrl();
  if (!baseUrl || !refreshToken) return;

  const response = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    throw new Error(`MyTree logout failed: ${response.status}`);
  }
}
