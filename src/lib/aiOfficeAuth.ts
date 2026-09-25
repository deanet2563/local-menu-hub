import liff from "@line/liff";
import { initLiff, PLATFORM_ADMIN_LIFF_ID } from "@/lib/supabase";

const AI_OFFICE_PATH = "/sweet/ai-office";
function normalizeAdminPath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
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

  if (liff.isLoggedIn()) return "ready";

  if (!liff.isInClient()) {
    liff.login({ redirectUri: `${window.location.origin}${adminPath}` });
    return "redirecting";
  }

  throw new Error("platform_admin_line_session_unavailable");
}

/**
 * Backward-compatible AI Office wrapper.
 */
export async function ensureAiOfficeLineLogin(): Promise<"ready" | "redirecting"> {
  return ensurePlatformAdminLineLogin(AI_OFFICE_PATH);
}
