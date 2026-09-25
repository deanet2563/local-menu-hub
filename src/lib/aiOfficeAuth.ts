import liff from "@line/liff";
import { initLiff, PLATFORM_ADMIN_LIFF_ID } from "@/lib/supabase";

const AI_OFFICE_PATH = "/sweet/ai-office";
function normalizeAdminPath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

/**
 * Platform-admin surfaces must enter through the LIFF permanent URL when a raw
 * Pages/domain URL is opened from LINE's generic in-app browser. This preserves
 * LINE account context before customer_id / platform_admins checks run.
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
