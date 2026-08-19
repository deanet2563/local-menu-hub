import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'mytree.shop.session.v1';

export type ShopSession = {
  accessToken: string;
  customerId: string;
  expiresAt: number;
  lineIdToken?: string;
};

export async function saveShopSession(session: ShopSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadShopSession(): Promise<ShopSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as ShopSession;
    if (!session.accessToken || !session.customerId || !session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}

export async function clearShopSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function isShopSessionFresh(session: ShopSession, skewSeconds = 60) {
  return session.expiresAt - skewSeconds > Math.floor(Date.now() / 1000);
}

export async function getValidShopAccessToken(): Promise<string | null> {
  const session = await loadShopSession();
  if (!session || !isShopSessionFresh(session)) return null;
  return session.accessToken;
}

export async function getValidLineIdToken(): Promise<string | null> {
  const session = await loadShopSession();
  if (!session || !isShopSessionFresh(session) || !session.lineIdToken) return null;
  return session.lineIdToken;
}
