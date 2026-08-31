import liff from "@line/liff";
import { initLiff, isOrderingPreview } from "@/lib/supabase";
import { cart, type CartBundleSelection, type CartOptionSelection } from "@/lib/cart";
import { getDeliveryQuoteToken, type DeliveryLocationSource } from "@/lib/deliveryLocation";

// ============================================================
// MyTree — submit an order to the worker /order endpoint.
// Client sends selections only. Worker remains authoritative for prices,
// availability, option/bundle validity, fulfillment and final snapshots.
// Customer-created set metadata is carried through as grouping metadata only;
// it never changes server-authoritative prices.
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
  setId?: string | null;
  setName?: string | null;
};

export type OrderPayload = {
  shopId: string;
  items: OrderLinePayload[];
  fulfillment: "delivery" | "pickup";
  payment: "cash" | "qr_transfer";
  address: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  locationSource?: DeliveryLocationSource | null;
  locationAccuracyM?: number | null;
  submittedMapUrl?: string | null;
  deliveryQuoteToken?: string | null;
  note: string | null;
  requestedFor?: string | null;
};

function withSetMetadata(order: OrderPayload): OrderPayload {
  const byLine = new Map(cart.getState().items.map((i) => [i.lineId, i]));
  return {
    ...order,
    items: order.items.map((line) => {
      const cartLine = byLine.get(line.lineId);
      return {
        ...line,
        setId: line.setId ?? cartLine?.setId ?? null,
        setName: line.setName ?? cartLine?.setName ?? null,
      };
    }),
  };
}

function withDeliveryQuoteToken(order: OrderPayload): OrderPayload {
  if (order.fulfillment !== "delivery" || order.deliveryQuoteToken) return order;
  return {
    ...order,
    deliveryQuoteToken: getDeliveryQuoteToken(order.shopId, order.destinationLat, order.destinationLng),
  };
}

function validateDeliveryDestination(order: OrderPayload): string | null {
  if (order.fulfillment !== "delivery") return null;
  const hasLat = typeof order.destinationLat === "number" && Number.isFinite(order.destinationLat);
  const hasLng = typeof order.destinationLng === "number" && Number.isFinite(order.destinationLng);
  if (!hasLat || !hasLng) {
    return "กรุณายืนยันจุดส่งก่อนสั่ง โดยวาง Google Maps link / latitude, longitude หรือใช้ตำแหน่งปัจจุบัน";
  }
  if (order.destinationLat! < -90 || order.destinationLat! > 90) return "ตำแหน่งละติจูดไม่ถูกต้อง กรุณาอัปเดตตำแหน่งใหม่";
  if (order.destinationLng! < -180 || order.destinationLng! > 180) return "ตำแหน่งลองจิจูดไม่ถูกต้อง กรุณาอัปเดตตำแหน่งใหม่";
  if (!order.deliveryQuoteToken) return "กรุณาคำนวณระยะทางและค่าส่งใหม่ก่อนยืนยันออเดอร์";
  return null;
}

export async function submitOrder(
  order: OrderPayload
): Promise<{ ok: boolean; order_id?: string; error?: string }> {
  const quotedOrder = withDeliveryQuoteToken(order);
  const deliveryDestinationError = validateDeliveryDestination(quotedOrder);
  if (deliveryDestinationError) return { ok: false, error: deliveryDestinationError };

  await initLiff();

  if (!liff.isLoggedIn()) {
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
    const enrichedOrder = withSetMetadata(quotedOrder);
    const res = await fetch(ORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, order: enrichedOrder }),
    });
    const data = (await res.json()) as { ok?: boolean; order_id?: string; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `error ${res.status}` };
    return { ok: true, order_id: data.order_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}
