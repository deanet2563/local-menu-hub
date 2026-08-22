import { refreshShopSession, revokeShopSession } from '../auth/broker';
import { clearShopSession, isShopRefreshSessionFresh, isShopSessionFresh, loadShopSession } from '../auth/session';

let refreshInFlight: Promise<string | null> | null = null;

export async function getAccessToken(): Promise<string | null> {
  const session = await loadShopSession();
  if (!session) return null;
  if (isShopSessionFresh(session)) return session.accessToken;

  // Legacy pre-Phase-1 sessions have no refresh credential. They remain valid
  // until their existing access token expires, then require one LINE login.
  if (!isShopRefreshSessionFresh(session) || !session.refreshToken) {
    await clearShopSession();
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshed = await refreshShopSession(session.refreshToken!);
        return refreshed.accessToken;
      } catch {
        await clearShopSession();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function logoutShopSession(): Promise<void> {
  const session = await loadShopSession();
  try {
    if (session?.refreshToken) await revokeShopSession(session.refreshToken);
  } finally {
    await clearShopSession();
  }
}

export async function clearAccessToken(): Promise<void> {
  await clearShopSession();
}
