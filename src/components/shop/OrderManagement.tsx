import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// MyTree — Shop order management (directory model: shop picks rider)
// Flow: รับออเดอร์ -> พิมพ์ครัว -> ทำอาหาร -> (delivery) เลือกวิน -> ส่ง
//
// No push notification from the server (removed to control LINE messaging
// cost — see worker /order handler). Instead: auto-poll + an in-page sound
// chime when a new order appears, so the shop must keep this page open.
// ============================================================

type Item = { item_name_snapshot: string; qty: number; line_total: number };
type Order = {
  sub_id: string; order_id: string; fulfillment_type: "pickup" | "delivery";
  order_status: string; payment_status: string; print_status: string; delivery_status: string;
  delivery_photo_url: string | null;
  customer_note: string | null;
  hub_orders: { customers: { name: string | null; phone: string | null } | null } | null;
  payment_method: "cash" | "qr_transfer"; payment_slip_url: string | null;
  delivery_address: string | null; amount: number; assigned_rider_id: string | null; created_at: string;
  order_items: Item[];
};
type Rider = { rider_id: string; name: string; phone: string; distance_km: number; is_busy: boolean; location_age_min: number };

const POLL_MS = 15_000; // auto-refresh interval while the tab is visible
const SOUND_PREF_KEY = "mytree_shop_sound_enabled";

/** Two-tone ascending chime via Web Audio — no external asset needed. */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 1108.73].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.16;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}

export function OrderManagement({ shopId }: { shopId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [riderInfo, setRiderInfo] = useState<Record<string, { name: string; phone: string }>>({});
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [live, setLive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenPendingIdsRef = useRef<Set<string> | null>(null); // null = not initialized yet (skip sound on first load)

  const enableSound = () => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    playChime(audioCtxRef.current); // audible confirmation right away
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setSoundEnabled(true);
    localStorage.setItem(SOUND_PREF_KEY, "1");
  };

  useEffect(() => {
    if (localStorage.getItem(SOUND_PREF_KEY) === "1") setSoundEnabled(true);
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sub_orders")
      .select("sub_id,order_id,fulfillment_type,order_status,payment_status,print_status,delivery_status,delivery_address,delivery_photo_url,payment_method,payment_slip_url,customer_note,amount,assigned_rider_id,created_at,order_items(item_name_snapshot,qty,line_total),hub_orders(customers(name,phone))")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    const list = (data as unknown as Order[]) ?? [];
    setOrders(list);

    // detect newly-arrived pending orders since the last poll
    const currentPendingIds = new Set(list.filter((o) => o.order_status === "pending").map((o) => o.sub_id));
    if (seenPendingIdsRef.current) {
      const newOnes = [...currentPendingIds].filter((id) => !seenPendingIdsRef.current!.has(id));
      if (newOnes.length > 0) {
        if (soundEnabled && audioCtxRef.current) {
          if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
          playChime(audioCtxRef.current);
        }
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          new Notification("🧾 ออเดอร์ใหม่เข้า MyTree", {
            body: newOnes.length === 1 ? "มีออเดอร์ใหม่ 1 รายการ" : `มีออเดอร์ใหม่ ${newOnes.length} รายการ`,
          });
        }
      }
    }
    seenPendingIdsRef.current = currentPendingIds;

    const ids = Array.from(new Set(list.map((o) => o.assigned_rider_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: rs } = await supabase.from("riders").select("id,name,phone").in("id", ids);
      const map: Record<string, { name: string; phone: string }> = {};
      ((rs as { id: string; name: string; phone: string }[]) ?? []).forEach((r) => (map[r.id] = { name: r.name, phone: r.phone }));
      setRiderInfo((prev) => ({ ...prev, ...map }));
    }
    setLoading(false);
    setLastSynced(new Date());
  }, [shopId, soundEnabled]);

  useEffect(() => { load(); }, [load]);

  // Auto-poll while the tab is visible; pause when hidden (saves requests + battery).
  // Also does one immediate refresh whenever the tab becomes visible again.
  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      setLive(visible);
      if (visible) load();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (document.visibilityState === "visible") {
      intervalId = setInterval(load, POLL_MS);
    }
    // re-arm the interval whenever visibility flips to visible
    const armInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = document.visibilityState === "visible" ? setInterval(load, POLL_MS) : null;
    };
    document.addEventListener("visibilitychange", armInterval);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("visibilitychange", armInterval);
      if (intervalId) clearInterval(intervalId);
    };
  }, [load]);

  const upd = async (sub_id: string, patch: Record<string, unknown>) => {
    await supabase.from("sub_orders").update(patch).eq("sub_id", sub_id);
    load();
  };

  const openPicker = async (sub_id: string) => {
    setPickerFor(sub_id);
    const { data } = await supabase.rpc("fn_riders_near_shop", { p_shop_id: shopId, p_service: "delivery" });
    setRiders((data as Rider[]) ?? []);
  };

  const assign = async (sub_id: string, r: Rider) => {
    setRiderInfo((m) => ({ ...m, [r.rider_id]: { name: r.name, phone: r.phone } }));
    await supabase.from("sub_orders").update({ assigned_rider_id: r.rider_id, delivery_status: "rider_called" }).eq("sub_id", sub_id);
    setPickerFor(null);
    load();
  };

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  const active = orders.filter((o) => o.order_status !== "completed" && o.order_status !== "cancelled");
  const done = orders.filter((o) => o.order_status === "completed" || o.order_status === "cancelled");

  return (
    <div className="p-4 pb-8 space-y-3 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">🧾 ออเดอร์เข้า</h1>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">
            {live ? "🟢 อัปเดตอัตโนมัติ" : "⏸ หยุดชั่วคราว"}
            {lastSynced && ` · ${lastSynced.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </span>
          <button onClick={load} className="text-xs text-orange-500">↻</button>
        </div>
      </div>

      {!soundEnabled ? (
        <button
          onClick={enableSound}
          className="w-full rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-sm px-3 py-2.5 text-left"
        >
          🔔 <span className="font-medium">กดเปิดเสียงแจ้งเตือนออเดอร์</span>
          <br />
          <span className="text-xs text-orange-600">
            ระบบไม่ส่งแจ้งเตือนผ่าน LINE แล้ว — ต้องเปิดเสียงตรงนี้ + เปิดหน้านี้ทิ้งไว้ตลอดเวลาขายของ
            เพื่อไม่พลาดออเดอร์ใหม่
          </span>
        </button>
      ) : (
        <p className="text-xs text-gray-400">
          🔊 เสียงแจ้งเตือนเปิดอยู่ — เปิดหน้านี้ทิ้งไว้ที่ร้านตลอดเวลาขาย ระบบจะเช็คออเดอร์ใหม่ให้ทุก 15 วินาที
        </p>
      )}

      {active.length === 0 && <p className="text-sm text-gray-400">ไม่มีออเดอร์ที่ต้องจัดการ</p>}

      {active.map((o) => {
        const paid = o.payment_status === "paid";
        return (
          <div key={o.sub_id} className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {o.fulfillment_type === "delivery" ? "🛵 ส่งถึงบ้าน" : "🏪 รับเอง"}
              </span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {paid ? "จ่ายแล้ว" : o.payment_method === "qr_transfer" ? "รอยืนยันโอน" : "เก็บปลายทาง"}
              </span>
            </div>

            {o.hub_orders?.customers && (
              <p className="text-sm text-gray-600">
                👤 {o.hub_orders.customers.name || "(ไม่มีชื่อ)"}
                {o.hub_orders.customers.phone && (
                  <> · <a href={`tel:${o.hub_orders.customers.phone}`} className="underline">📞 {o.hub_orders.customers.phone}</a></>
                )}
              </p>
            )}

            <div className="text-sm text-gray-700">
              {o.order_items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.item_name_snapshot} × {i.qty}</span>
                  <span className="text-gray-500">฿{i.line_total}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-1">
              <span className="font-medium">รวม</span><span className="font-medium">฿{o.amount}</span>
            </div>
            {o.customer_note && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">📝 {o.customer_note}</p>
            )}
            {o.fulfillment_type === "delivery" && o.delivery_address && (
              <p className="text-xs text-gray-500">📍 {o.delivery_address}</p>
            )}
            {o.delivery_photo_url && (
              <div>
                <p className="text-xs text-gray-500 mb-1">📷 รูปยืนยันส่งของ</p>
                <img src={o.delivery_photo_url} alt="delivery proof" className="w-full rounded-lg object-cover" />
              </div>
            )}
            {o.payment_method === "qr_transfer" && !paid && (
              <div className="rounded-lg bg-purple-50 p-2 space-y-1">
                {o.payment_slip_url ? (
                  <>
                    <p className="text-xs text-purple-700">💳 ลูกค้าแนบสลิปแล้ว — ตรวจสอบก่อนกดยืนยัน</p>
                    <img src={o.payment_slip_url} alt="payment slip" className="w-32 rounded-lg object-cover" />
                    <button onClick={() => upd(o.sub_id, { payment_status: "paid" })} className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5">
                      ✅ ยืนยันได้รับเงินแล้ว
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-purple-500">รอลูกค้าแนบสลิปโอนเงิน</p>
                )}
              </div>
            )}

            {/* actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              {o.order_status === "pending" && (
                <button onClick={() => upd(o.sub_id, { order_status: "confirmed" })} className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5">รับออเดอร์</button>
              )}
              {o.order_status !== "pending" && (
                <button onClick={() => upd(o.sub_id, { print_status: o.print_status === "not_printed" ? "printed" : "reprinted" })} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">
                  {o.print_status === "not_printed" ? "🖨 พิมพ์ครัว" : "🖨 พิมพ์ซ้ำ"}
                </button>
              )}
              {o.order_status === "confirmed" && (
                <button onClick={() => upd(o.sub_id, { order_status: "preparing" })} className="rounded-lg bg-orange-100 text-orange-700 text-xs px-3 py-1.5">เริ่มทำอาหาร</button>
              )}

              {/* pickup completion */}
              {o.fulfillment_type === "pickup" && (o.order_status === "confirmed" || o.order_status === "preparing") && (
                <button onClick={() => upd(o.sub_id, { order_status: "completed" })} className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5">ลูกค้ารับแล้ว ✓</button>
              )}

              {/* delivery flow */}
              {o.fulfillment_type === "delivery" && o.delivery_status === "needs_rider" && o.order_status !== "pending" && (
                <button onClick={() => openPicker(o.sub_id)} className="rounded-lg bg-blue-500 text-white text-xs px-3 py-1.5">🛵 เลือกวิน</button>
              )}
              {o.fulfillment_type === "delivery" && o.delivery_status === "rider_called" && (() => {
                const riderContact = o.assigned_rider_id ? riderInfo[o.assigned_rider_id] : undefined;
                return (
                  <>
                    {riderContact && (
                      <a href={`tel:${riderContact.phone}`} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">
                        📞 {riderContact.name}
                      </a>
                    )}
                    <button onClick={() => upd(o.sub_id, { delivery_status: "picked_up" })} className="rounded-lg bg-orange-100 text-orange-700 text-xs px-3 py-1.5">วินรับของแล้ว</button>
                  </>
                );
              })()}
              {o.fulfillment_type === "delivery" && o.delivery_status === "picked_up" && (
                <button onClick={() => upd(o.sub_id, { delivery_status: "delivered", order_status: "completed" })} className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5">ส่งถึงแล้ว ✓</button>
              )}
            </div>

            {/* rider picker (directory) */}
            {pickerFor === o.sub_id && (
              <div className="rounded-lg bg-gray-50 p-2 space-y-1 mt-1">
                <p className="text-xs text-gray-500 mb-1">เลือกวิน (เรียงใกล้+ว่างก่อน)</p>
                {riders.length === 0 && <p className="text-xs text-gray-400">ไม่มีวินออนไลน์ตอนนี้</p>}
                {riders.map((r) => (
                  <button key={r.rider_id} onClick={() => assign(o.sub_id, r)} className="w-full flex items-center justify-between rounded-lg bg-white border border-gray-100 px-3 py-2 text-sm">
                    <span>{r.name}</span>
                    <span className="text-xs text-gray-500">
                      {r.distance_km != null ? `${(r.distance_km * 1000).toFixed(0)} ม.` : ""} · {r.is_busy ? "🟠 กำลังส่ง" : "🟢 ว่าง"}
                    </span>
                  </button>
                ))}
                <button onClick={() => setPickerFor(null)} className="w-full text-xs text-gray-400 pt-1">ยกเลิก</button>
              </div>
            )}
          </div>
        );
      })}

      {done.length > 0 && (
        <details className="pt-2">
          <summary className="text-sm text-gray-500">เสร็จแล้ว ({done.length})</summary>
          <div className="space-y-2 mt-2">
            {done.map((o) => (
              <div key={o.sub_id} className="rounded-lg border border-gray-100 p-3 text-sm text-gray-500">
                {o.order_items.map((i) => `${i.item_name_snapshot}×${i.qty}`).join(", ")} — ฿{o.amount} {o.order_status === "cancelled" ? "(ยกเลิก)" : "✓"}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
