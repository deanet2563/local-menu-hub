import liff from "@line/liff";
import { initLiff, LIFF_ID } from "@/lib/supabase";

const AI_OFFICE_PATH = "/sweet/ai-office";
const LIFF_HOST = "liff.line.me";

function isLiffEntryUrl(): boolean {
  return window.location.hostname === LIFF_HOST;
}

/**
 * AI Office is an admin-only surface. A raw Pages URL opened from a LINE chat
 * is only LINE's generic in-app browser; it is NOT automatically a LIFF
 * browser. Route that entry through the LIFF permanent URL first so LINE can
 * establish the LIFF context and authenticated session.
 *
 * Customer checkout behavior remains unchanged because this helper is used
 * only by the AI Office route.
 */
export async function ensureAiOfficeLineLogin(): Promise<"ready" | "redirecting"> {
  // If the user reached the raw Pages route (even from inside LINE), enter the
  // LIFF app properly. LINE carries this extra path through liff.state and
  // restores it after liff.init().
  if (!isLiffEntryUrl() && !window.location.search.includes("liff.state=")) {
    window.location.replace(`https://liff.line.me/${LIFF_ID}${AI_OFFICE_PATH}`);
    return "redirecting";
  }

  await initLiff();

  // Inside a real LIFF browser the login context should already be available
  // after init. In an external/in-app browser fallback, liff.login() is the
  // supported way to establish the session.
  if (liff.isLoggedIn()) return "ready";

  if (!liff.isInClient()) {
    liff.login({ redirectUri: `${window.location.origin}${AI_OFFICE_PATH}` });
    return "redirecting";
  }

  // In a LIFF browser login is normally automatic during init. If no session
  // exists even here, re-enter through the LIFF permanent link instead of
  // showing a false "please login" dead-end.
  window.location.replace(`https://liff.line.me/${LIFF_ID}${AI_OFFICE_PATH}`);
  return "redirecting";
}
