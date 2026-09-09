import liff from "@line/liff";
import { initLiff } from "@/lib/supabase";

/**
 * AI Office is an admin surface and is allowed to actively establish a LINE
 * session. Customer checkout intentionally does NOT auto-login in an external
 * browser, so keep this behavior isolated to the AI Office route.
 */
export async function ensureAiOfficeLineLogin(): Promise<"ready" | "redirecting"> {
  await initLiff();

  if (liff.isLoggedIn()) return "ready";

  // This covers both a true LIFF window and the LINE in-app browser opened
  // from a raw Pages link. liff.login() returns to this exact AI Office URL
  // after LINE OAuth completes.
  liff.login({ redirectUri: window.location.href });
  return "redirecting";
}
