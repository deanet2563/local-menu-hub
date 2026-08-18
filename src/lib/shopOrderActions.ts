import liff from "@line/liff";
import { initLiff, isOrderingPreview } from "@/lib/supabase";

const ACCEPT_URL = "https://mytree-worker.kompakorn-t.workers.dev/shop/order/accept";

export async function acceptShopOrder(subId: string): Promise<{ ok: boolean; error?: string }> {
  await initLiff();
  if (!liff.isLoggedIn()) {
    if (isOrderingPreview()) return { ok: false, error: "ต้องเปิดผ่าน LIFF เพื่อรับออเดอร์" };
    liff.login();
    return { ok: false, error: "กำลังเข้าสู่ระบบ LINE..." };
  }

  const idToken = liff.getIDToken();
  if (!idToken) return { ok: false, error: "ไม่พบ LINE idToken" };

  try {
    const res = await fetch(ACCEPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, subId }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? `error ${res.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "network error" };
  }
}
