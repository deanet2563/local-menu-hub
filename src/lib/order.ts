import liff from "@line/liff";
import { initLiff, isOrderingPreview } from "@/lib/supabase";
import type { CartBundleSelection, CartOptionSelection } from "@/lib/cart";

// ============================================================
// MyTree — submit an order to the worker /order endpoint.
// Client sends selections only. Worker remains authoritative for prices,
// availability, option/bundle validity, fulfillment and final snapshots.
// ============================================================

const ORDER_URL = "https://mytree-worker.kompakorn-t.workers.dev/order";

export type OrderLinePayload = {
  lineId: string;
  kind: "item" | "bundle";
  itemId: string;
  qty: number;
  options: CartOptionSelection[];
  note: string | null;
  bundleSelections: CartBundleSelection[];
};

export type OrderPayload = {
  shopId: string;
  items: OrderLinePayload[];
  fulfillment: "delivery" | "pickup";
  payment: "cash" | "qr_transfer";
  address: string | null;
  note: string | null;
  requestedFor?: string | null;
};

export async function submitOrder(
  order: OrderPayload
): Promise<{ ok: boolean; order_id?: string; error?: string }> {
  await initLiff();

  if (!liff.isLoggedIn()) {
    // The raw Cloudflare preview URL is for UX testing only. Once this same
    // hostname is opened through its staging LIFF URL, LIFF supplies a logged
    // in session and real order submission is allowed.
    if (isOrderingPreview()) {
      return {
        ok: false,
        error: "โหมดทดสอบหน้าเว็บยังไม่ได้เปิดผ่าน LIFF staging จึงยังไม่ส่งคำสั่งซื้อจริง",
      };
    }
    liff.login();
    return { ok: false, error: "กำลังเข้าสู่ระบบ LINE..." };
  }

  const idToken = liff.getIDToken();
  if (!idToken) return { ok: false, error: "ไม่พบ LINE idToken" };

  try {
    const res = await fetch(ORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, order }),
    });
    const data = (await res.json()) as { ok?: boolean; order_id?: string; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `error ${res.status}` };
    return { ok: true, order_id: data.order_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}
