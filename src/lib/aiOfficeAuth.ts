import liff from "@line/liff";
import { initLiff, PLATFORM_ADMIN_LIFF_ID } from "@/lib/supabase";
import {
  getPlatformAdminIdTokenStatus,
  mayStartPlatformAdminReauthentication,
} from "@/lib/platformAdminSessionPolicy";

const AI_OFFICE_PATH = "/sweet/ai-office";
const ADMIN_LOGIN_PENDING_PREFIX = "mytree:platform-admin-login:";
const ADMIN_TOKEN_REAUTH_ATTEMPT_PREFIX = "mytree:platform-admin-token-reauth:";
const ADMIN_TOKEN_REAUTH_FAILED_PREFIX = "mytree:platform-admin-token-reauth-failed:";
const ADMIN_BROKER_REAUTH_ATTEMPT_PREFIX = "mytree:platform-admin-broker-reauth:";
const ADMIN_BROKER_REAUTH_FAILED_PREFIX = "mytree:platform-admin-broker-reauth-failed:";

function normalizeAdminPath(path: string): string {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error("platform_admin_redirect_uri_invalid");
  return `${url.pathname}${url.search}${url.hash}`;
}

function adminPathname(adminPath: string): string {
  return new URL(adminPath, window.location.origin).pathname;
}

function adminLoginPendingKey(adminPath: string): string {
  return `${ADMIN_LOGIN_PENDING_PREFIX}${adminPathname(adminPath)}`;
}

function adminTokenReauthAttemptKey(adminPath: string): string {
  return `${ADMIN_TOKEN_REAUTH_ATTEMPT_PREFIX}${adminPathname(adminPath)}`;
}

function adminTokenReauthFailedKey(adminPath: string): string {
  return `${ADMIN_TOKEN_REAUTH_FAILED_PREFIX}${adminPathname(adminPath)}`;
}

function adminBrokerReauthAttemptKey(adminPath: string): string {
  return `${ADMIN_BROKER_REAUTH_ATTEMPT_PREFIX}${adminPathname(adminPath)}`;
}

function adminBrokerReauthFailedKey(adminPath: string): string {
  return `${ADMIN_BROKER_REAUTH_FAILED_PREFIX}${adminPathname(adminPath)}`;
}

function getIdTokenStatus(): ReturnType<typeof getPlatformAdminIdTokenStatus> {
  const channelId = /^(\d+)-/.exec(PLATFORM_ADMIN_LIFF_ID)?.[1];
  return getPlatformAdminIdTokenStatus(liff.getDecodedIDToken(), channelId);
}

function readRecoveryAttempt(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    throw new Error("platform_admin_login_state_unavailable");
  }
}

function startAdminLogin(
  adminPath: string,
  pendingKey: string,
  recovery?: { attemptKey: string; pendingState: "token-reauth" | "broker-reauth" },
): "redirecting" {
  if (liff.isInClient()) throw new Error("platform_admin_line_session_unavailable");
  try {
    if (recovery) {
      if (!mayStartPlatformAdminReauthentication(readRecoveryAttempt(recovery.attemptKey))) {
        throw new Error("platform_admin_reauthentication_exhausted");
      }
      window.sessionStorage.setItem(recovery.attemptKey, "1");
    }
    window.sessionStorage.setItem(pendingKey, recovery?.pendingState ?? "initial");
  } catch (error) {
    if (error instanceof Error && error.message === "platform_admin_reauthentication_exhausted") throw error;
    throw new Error("platform_admin_login_state_unavailable");
  }

  try {
    // Clear only this LIFF session so LINE issues a fresh channel-bound ID token.
    if (liff.isLoggedIn()) liff.logout();
    liff.login({ redirectUri: `${window.location.origin}${adminPath}` });
  } catch (error) {
    try { window.sessionStorage.removeItem(pendingKey); } catch { /* keep the recovery guard fail-closed */ }
    throw error;
  }
  return "redirecting";
}

/**
 * Initialize the dedicated Admin LIFF and require a fresh token for the Admin
 * Login channel. External direct entry gets one initial login and, when needed,
 * one guarded recovery while preserving the exact requested Head Office path.
 */
export async function ensurePlatformAdminLineLogin(
  requestedPath = window.location.pathname + window.location.search,
): Promise<"ready" | "redirecting"> {
  const adminPath = normalizeAdminPath(requestedPath);
  if (!PLATFORM_ADMIN_LIFF_ID) throw new Error("platform_admin_liff_not_configured");

  await initLiff();

  const pendingKey = adminLoginPendingKey(adminPath);
  const tokenReauthKey = adminTokenReauthAttemptKey(adminPath);
  const tokenReauthFailedKey = adminTokenReauthFailedKey(adminPath);
  const brokerFailedKey = adminBrokerReauthFailedKey(adminPath);
  const status = getIdTokenStatus();

  if (status === "wrong_audience") {
    try { window.sessionStorage.removeItem(pendingKey); } catch { /* fail closed below */ }
    throw new Error("platform_admin_id_token_audience_mismatch");
  }
  if (readRecoveryAttempt(tokenReauthFailedKey) || readRecoveryAttempt(brokerFailedKey)) {
    throw new Error("platform_admin_reauthentication_exhausted");
  }
  if (liff.isLoggedIn() && status === "valid") {
    try { window.sessionStorage.removeItem(pendingKey); } catch { /* no pending state to clear */ }
    return "ready";
  }
  if (liff.isInClient()) {
    throw new Error(status === "expired" || status === "missing"
      ? "platform_admin_line_session_stale"
      : "platform_admin_line_session_unavailable");
  }

  let pending: string | null;
  try {
    pending = window.sessionStorage.getItem(pendingKey);
  } catch {
    throw new Error("platform_admin_login_state_unavailable");
  }

  if (!liff.isLoggedIn() && !pending) {
    // First-time external entry is an ordinary login, not a recovery attempt.
    return startAdminLogin(adminPath, pendingKey);
  }

  // A missing/expired token or failed initial callback receives one controlled
  // LIFF reauthentication. A wrong-channel token above always fails closed.
  if (pending === "token-reauth" && readRecoveryAttempt(tokenReauthKey)) {
    try {
      window.sessionStorage.removeItem(pendingKey);
      window.sessionStorage.setItem(tokenReauthFailedKey, "1");
    } catch { /* keep guard */ }
    throw new Error("platform_admin_reauthentication_exhausted");
  }
  if (pending === "broker-reauth" && readRecoveryAttempt(adminBrokerReauthAttemptKey(adminPath))) {
    try {
      window.sessionStorage.removeItem(pendingKey);
      window.sessionStorage.setItem(brokerFailedKey, "1");
    } catch { /* keep guard */ }
    throw new Error("platform_admin_reauthentication_exhausted");
  }
  return startAdminLogin(adminPath, pendingKey, {
    attemptKey: tokenReauthKey,
    pendingState: "token-reauth",
  });
}

/** Start one controlled Admin LIFF recovery after the Worker rejects the ID token. */
export async function reauthenticatePlatformAdminLineSession(
  requestedPath = window.location.pathname + window.location.search,
): Promise<"redirecting"> {
  if (!PLATFORM_ADMIN_LIFF_ID) throw new Error("platform_admin_liff_not_configured");
  const adminPath = normalizeAdminPath(requestedPath);
  await initLiff();
  if (getIdTokenStatus() === "wrong_audience") {
    throw new Error("platform_admin_id_token_audience_mismatch");
  }
  const reauthKey = adminBrokerReauthAttemptKey(adminPath);
  if (!mayStartPlatformAdminReauthentication(readRecoveryAttempt(reauthKey))) {
    try { window.sessionStorage.setItem(adminBrokerReauthFailedKey(adminPath), "1"); } catch { /* fail closed below */ }
    throw new Error("platform_admin_reauthentication_exhausted");
  }
  return startAdminLogin(adminPath, adminLoginPendingKey(adminPath), {
    attemptKey: reauthKey,
    pendingState: "broker-reauth",
  });
}

/** Clear the reauthentication guard only after the Worker accepts a LINE token. */
export function clearPlatformAdminSessionRecovery(): void {
  const adminPath = normalizeAdminPath(window.location.pathname + window.location.search);
  try {
    window.sessionStorage.removeItem(adminLoginPendingKey(adminPath));
    window.sessionStorage.removeItem(adminTokenReauthAttemptKey(adminPath));
    window.sessionStorage.removeItem(adminTokenReauthFailedKey(adminPath));
    window.sessionStorage.removeItem(adminBrokerReauthAttemptKey(adminPath));
    window.sessionStorage.removeItem(adminBrokerReauthFailedKey(adminPath));
  } catch { /* session storage may be unavailable; auth itself remains verified */ }
}

/** Backward-compatible AI Office wrapper. */
export async function ensureAiOfficeLineLogin(): Promise<"ready" | "redirecting"> {
  return ensurePlatformAdminLineLogin(AI_OFFICE_PATH);
}
