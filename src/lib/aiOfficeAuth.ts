import liff from "@line/liff";
import { initLiff, PLATFORM_ADMIN_LIFF_ID } from "@/lib/supabase";

const AI_OFFICE_PATH = "/sweet/ai-office";
const ADMIN_LOGIN_PENDING_PREFIX = "mytree:platform-admin-login:";

function normalizeAdminPath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

function adminLoginPendingKey(adminPath: string): string {
  const pathname = new URL(adminPath, window.location.origin).pathname;
  return `${ADMIN_LOGIN_PENDING_PREFIX}${pathname}`;
}

function hasPlatformAdminChannelToken(): boolean {
  const channelId = /^(\d+)-/.exec(PLATFORM_ADMIN_LIFF_ID)?.[1];
  return Boolean(
    channelId
    && liff.isLoggedIn()
    && liff.getDecodedIDToken()?.aud === channelId,
  );
}

/**
 * Platform-admin surfaces initialize the dedicated Admin LIFF directly on the
 * canonical MyTree URL. If no LINE session exists, LIFF login returns to the
 * same admin path without bouncing through the Customer LIFF or a preview host.
 */
export async function ensurePlatformAdminLineLogin(
  requestedPath = window.location.pathname + window.location.search,
): Promise<"ready" | "redirecting"> {
  const adminPath = normalizeAdminPath(requestedPath);

  if (!PLATFORM_ADMIN_LIFF_ID) {
    throw new Error("platform_admin_liff_not_configured");
  }

  // Initialize the dedicated Admin LIFF on the current MyTree URL first.
  // This supports both direct https://mytree.cc/head-office entry and the
  // LIFF secondary redirect without bouncing back to liff.line.me.
  await initLiff();

  const pendingKey = adminLoginPendingKey(adminPath);
  if (hasPlatformAdminChannelToken()) {
    // The Worker authorizes the LINE Login channel audience, not a specific
    // LIFF app. Reuse a token for that exact channel across Head Office route
    // remounts; a token from another channel must never reach the broker.
    try { window.sessionStorage.removeItem(pendingKey); } catch { /* no pending state to clear */ }
    return "ready";
  }

  if (liff.isInClient()) {
    throw new Error(liff.isLoggedIn()
      ? "platform_admin_id_token_audience_mismatch"
      : "platform_admin_line_session_unavailable");
  }

  // A direct browser may already have a token from another LINE Login
  // channel. Run one Admin LIFF round-trip, preserve the requested path, and
  // fail closed if the callback still does not provide the expected audience.
  let loginPending = false;
  try {
    loginPending = window.sessionStorage.getItem(pendingKey) === "1";
  } catch {
    throw new Error("platform_admin_login_state_unavailable");
  }

  if (loginPending) {
    try { window.sessionStorage.removeItem(pendingKey); } catch { /* fail closed below */ }
    throw new Error(liff.isLoggedIn()
      ? "platform_admin_id_token_audience_mismatch"
      : "platform_admin_line_session_unavailable");
  }

  try {
    window.sessionStorage.setItem(pendingKey, "1");
  } catch {
    throw new Error("platform_admin_login_state_unavailable");
  }
  liff.login({ redirectUri: `${window.location.origin}${adminPath}` });
  return "redirecting";
}

/**
 * Backward-compatible AI Office wrapper.
 */
export async function ensureAiOfficeLineLogin(): Promise<"ready" | "redirecting"> {
  return ensurePlatformAdminLineLogin(AI_OFFICE_PATH);
}
