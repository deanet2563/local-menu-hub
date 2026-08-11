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
  /** Reserved for the existing pre-order flow. Omitted for Order Now. */
  requestedFor?: string | null;
};

export async function submitOrder(
  order: OrderPayload
): Promise<{ ok: boolean; order_id?: string; error?: string }> {
  // The public Cloudflare preview is intentionally not a LIFF endpoint.
  // Never launch LINE login from here: the callback/session would not belong
  // to the preview app and the cart/order context would be lost. Preview is
  // for catalog/cart/checkout UX only; real order submission is tested from
  // a configured LIFF endpoint.
  if (isOrderingPreview()) {
    return {
      ok: false,
      error: "โหมดทดสอบหน้าเว็บยังไม่ส่งคำสั่งซื้อจริง กรุณาทดสอบการยืนยันออเดอร์ผ่าน LINE LIFF",
    };
  }

  await initLiff();
  if (!liff.isLoggedIn()) {
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
