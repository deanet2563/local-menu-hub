import { clearShopSession, getValidShopAccessToken } from '../auth/session';

export async function getAccessToken(): Promise<string | null> {
  return getValidShopAccessToken();
}

export async function clearAccessToken(): Promise<void> {
  await clearShopSession();
}
