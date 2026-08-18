import liff from "@line/liff";
import { initLiff } from "@/lib/supabase";

const CONFIRM_URL = "https://mytree-worker.kompakorn-t.workers.dev/shop/order/confirm";

export async function confirmShopOrder(subId: string): Promise<{ ok: boolean; error?: string; notificationSent?: boolean }> {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    return { ok: false, error: "กำลังเข้าสู่ระบบ LINE..." };
  }

  const idToken = liff.getIDToken();
  if (!idToken) return { ok: false, error: "ไม่พบ LINE idToken" };

  try {
    const res = await fetch(CONFIRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, subId }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      notification?: { sent?: boolean };
    };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? `error ${res.status}` };
    return { ok: true, notificationSent: data.notification?.sent === true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "network error" };
  }
}
