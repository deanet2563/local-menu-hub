import liff from "@line/liff";
import { initLiff } from "@/lib/supabase";

// ============================================================
// MyTree — switch the current user's LINE rich menu by role.
// Calls the worker's /richmenu/link, which does NOT count against the
// LINE OA message quota (it's a menu-management API call, not a message).
// ============================================================

const RICHMENU_URL = "https://mytree-worker.kompakorn-t.workers.dev/richmenu/link";

export async function linkRichMenu(target: "customer" | "shop" | "rider"): Promise<void> {
  try {
    await initLiff();
    if (!liff.isLoggedIn()) return; // best-effort; don't block signup flow on this
    const idToken = liff.getIDToken();
    if (!idToken) return;
    await fetch(RICHMENU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, target }),
    });
  } catch {
    // best-effort — never let a rich-menu switch failure block the signup flow
  }
}
