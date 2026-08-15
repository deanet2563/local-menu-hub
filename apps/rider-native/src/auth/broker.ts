import { saveRiderSession, type RiderSession } from '@/auth/session';

type BrokerResponse = {
  access_token: string;
  expires_in: number;
  customer_id: string;
};

function workerUrl() {
  return (process.env.EXPO_PUBLIC_MYTREE_WORKER_URL ?? '').replace(/\/$/, '');
}

export async function exchangeLineIdToken(lineIdToken: string, nonce?: string): Promise<RiderSession> {
  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');
  if (!lineIdToken) throw new Error('LINE ID token is required');

  const response = await fetch(`${baseUrl}/auth/line`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: lineIdToken, nonce }),
  });

  if (!response.ok) {
    throw new Error(`MyTree auth broker failed: ${response.status}`);
  }

  const data = (await response.json()) as BrokerResponse;
  if (!data.access_token || !data.customer_id || !data.expires_in) {
    throw new Error('MyTree auth broker returned an invalid session');
  }

  const now = Math.floor(Date.now() / 1000);
  const session: RiderSession = {
    accessToken: data.access_token,
    customerId: data.customer_id,
    expiresAt: now + data.expires_in,
  };

  await saveRiderSession(session);
  return session;
}
