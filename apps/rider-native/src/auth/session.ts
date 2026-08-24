import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'mytree.rider.session.v1';

export type RiderSession = {
  accessToken: string;
  customerId: string;
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
};

export async function saveRiderSession(session: RiderSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadRiderSession(): Promise<RiderSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as RiderSession;
    if (!parsed.accessToken || !parsed.customerId || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearRiderSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function isSessionFresh(session: RiderSession, skewSeconds = 60) {
  return session.expiresAt - skewSeconds > Math.floor(Date.now() / 1000);
}

export function isRefreshSessionFresh(session: RiderSession, skewSeconds = 60) {
  return !!session.refreshToken && !!session.refreshExpiresAt && session.refreshExpiresAt - skewSeconds > Math.floor(Date.now() / 1000);
}
