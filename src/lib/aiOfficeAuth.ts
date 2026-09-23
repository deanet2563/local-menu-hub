import liff from "@line/liff";
import { initLiff, LIFF_ID } from "@/lib/supabase";

const AI_OFFICE_PATH = "/sweet/ai-office";
const LIFF_HOST = "liff.line.me";

function isLiffEntryUrl(): boolean {
  return window.location.hostname === LIFF_HOST;
}

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

  if (!isLiffEntryUrl() && !window.location.search.includes("liff.state=")) {
    window.location.replace(`https://liff.line.me/${LIFF_ID}${adminPath}`);
    return "redirecting";
  }

  await initLiff();

  if (liff.isLoggedIn()) return "ready";

  if (!liff.isInClient()) {
    liff.login({ redirectUri: `${window.location.origin}${adminPath}` });
    return "redirecting";
  }

  window.location.replace(`https://liff.line.me/${LIFF_ID}${adminPath}`);
  return "redirecting";
}

/**
 * Backward-compatible AI Office wrapper.
 */
export async function ensureAiOfficeLineLogin(): Promise<"ready" | "redirecting"> {
  return ensurePlatformAdminLineLogin(AI_OFFICE_PATH);
}
