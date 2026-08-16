import liff from "@line/liff";
import { initLiff } from "@/lib/supabase";

// ============================================================
// MyTree — submit an order to the worker /order endpoint.
// Sends the LINE idToken + cart; the worker verifies, resolves the
// customer, prices from DB, creates the order, and notifies the shop.
// ============================================================

const ORDER_URL = "https://mytree-worker.kompakorn-t.workers.dev/order";

export type OrderPayload = {
  shopId: string;
  items: { itemId: string; qty: number }[];
  fulfillment: "delivery" | "pickup";
  payment: "cash";
  address: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  note: string | null;
};

export async function submitOrder(
  order: OrderPayload
): Promise<{ ok: boolean; order_id?: string; error?: string }> {
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
