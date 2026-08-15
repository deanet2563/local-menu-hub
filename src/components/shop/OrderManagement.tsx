import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  loadInterestedRiders,
  requestNearbyRiders,
  selectInterestedRider,
  type RiderCandidate,
} from "@/lib/riderDispatch";

// ============================================================
// MyTree — Shop order management
// Rider flow: Shop sends Nearby Rider Offer -> Rider Interested -> Shop selects.
// Final assignment is server-side/atomic; the shop UI never assigns a Rider
// directly to sub_orders.
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
  delivery_fee: number;
  delivery_fee_payer: "customer" | "shop";
  delivery_distance_km: number | null;
  order_items: Item[];
};

const POLL_MS = 15_000;
const SOUND_PREF_KEY = "mytree_shop_sound_enabled";

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
  const [candidateFor, setCandidateFor] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<RiderCandidate[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectingRiderId, setSelectingRiderId] = useState<string | null>(null);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [riderInfo, setRiderInfo] = useState<Record<string, { name: string; phone: string }>>({});
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [live, setLive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [feePayerSavingFor, setFeePayerSavingFor] = useState<string | null>(null);
  const [feePayerError, setFeePayerError] = useState<Record<string, string>>({});

  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenPendingIdsRef = useRef<Set<string> | null>(null);

  const enableSound = () => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    playChime(audioCtxRef.current);
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
      .select("sub_id,order_id,fulfillment_type,order_status,payment_status,print_status,delivery_status,delivery_address,delivery_photo_url,payment_method,payment_slip_url,customer_note,amount,assigned_rider_id,created_at,delivery_fee,delivery_fee_payer,delivery_distance_km,order_items(item_name_snapshot,qty,line_total),hub_orders(customers(name,phone))")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    const list = (data as unknown as Order[]) ?? [];
    setOrders(list);

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

  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      setLive(visible);
      if (visible) load();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (document.visibilityState === "visible") intervalId = setInterval(load, POLL_MS);
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

  useEffect(() => {
    if (!candidateFor) return;
    const interval = setInterval(() => {
      void refreshCandidates(candidateFor, true);
    }, 5_000);
    return () => clearInterval(interval);
  }, [candidateFor]);

  const upd = async (sub_id: string, patch: Record<string, unknown>) => {
    await supabase.from("sub_orders").update(patch).eq("sub_id", sub_id);
    load();
  };

  const setDeliveryFeePayer = async (subId: string, payer: "customer" | "shop") => {
    if (feePayerSavingFor) return;
    setFeePayerSavingFor(subId);
    setFeePayerError((prev) => ({ ...prev, [subId]: "" }));
    const { error } = await supabase
      .from("sub_orders")
      .update({ delivery_fee_payer: payer })
      .eq("sub_id", subId)
      .eq("delivery_status", "needs_rider");
    if (error) {
      setFeePayerError((prev) => ({ ...prev, [subId]: error.message }));
    } else {
      await load();
    }
    setFeePayerSavingFor(null);
  };

  const refreshCandidates = async (subId: string, silent = false) => {
    if (!silent) setCandidateLoading(true);
    setDispatchError(null);
    try {
      const rows = await loadInterestedRiders(subId);
      setCandidates(rows);
    } catch (error) {
      if (!silent) setDispatchError(error instanceof Error ? error.message : "โหลดผู้สนใจไม่สำเร็จ");
    } finally {
      if (!silent) setCandidateLoading(false);
    }
  };

  const findNearbyRiders = async (subId: string) => {
    setCandidateFor(subId);
    setCandidates([]);
    setDispatching(true);
    setDispatchMessage(null);
    setDispatchError(null);
    try {
      const result = await requestNearbyRiders(subId);
      if (result.candidates === 0) {
        setDispatchMessage(`ยังไม่พบ Rider ที่พร้อมรับงานภายใน ${result.usedRadiusKm} กม.`);
      } else {
        setDispatchMessage(
          `ส่งงานให้ Rider ใกล้ร้าน ${result.candidates} คนแล้ว · รัศมี ${result.usedRadiusKm} กม. รอ Rider กดสนใจ`,
        );
      }
      await refreshCandidates(subId, true);
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : "ส่งงานหา Rider ไม่สำเร็จ");
    } finally {
      setDispatching(false);
    }
  };

  const chooseCandidate = async (subId: string, candidate: RiderCandidate) => {
    if (selectingRiderId) return;
    setSelectingRiderId(candidate.riderId);
    setDispatchError(null);
    try {
      await selectInterestedRider(subId, candidate.riderId);
      setRiderInfo((prev) => ({
        ...prev,
        [candidate.riderId]: { name: candidate.name, phone: prev[candidate.riderId]?.phone ?? "" },
      }));
      setCandidateFor(null);
      setCandidates([]);
      setDispatchMessage(null);
      await load();
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : "เลือกรายเดอร์ไม่สำเร็จ");
      await refreshCandidates(subId, true);
    } finally {
      setSelectingRiderId(null);
    }
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
            เปิดเสียงตรงนี้ + เปิดหน้านี้ทิ้งไว้ระหว่างขาย ระบบจะเตือนเมื่อมีออเดอร์ใหม่
          </span>
        </button>
      ) : (
        <p className="text-xs text-gray-400">
          🔊 เสียงแจ้งเตือนเปิดอยู่ — ระบบเช็คออเดอร์ใหม่ทุก 15 วินาที
        </p>
      )}

      {active.length === 0 && <p className="text-sm text-gray-400">ไม่มีออเดอร์ที่ต้องจัดการ</p>}

      {active.map((o) => {
        const paid = o.payment_status === "paid";
        const feePayerLocked = o.delivery_status !== "needs_rider";
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

            {o.fulfillment_type === "delivery" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-emerald-700">ค่าส่งที่ Rider ต้องได้รับ</p>
                    <p className="text-lg font-bold text-emerald-800">฿{Number(o.delivery_fee ?? 40).toFixed(0)}</p>
                  </div>
                  {o.delivery_distance_km != null && (
                    <p className="text-xs font-medium text-emerald-700">ร้าน → ลูกค้า {Number(o.delivery_distance_km).toFixed(1)} กม.</p>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-700">Rider เก็บค่าส่งจากใคร</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryFeePayer(o.sub_id, "customer")}
                    disabled={feePayerLocked || feePayerSavingFor === o.sub_id}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium disabled:opacity-50 ${
                      o.delivery_fee_payer !== "shop"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    👤 ลูกค้าจ่าย
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryFeePayer(o.sub_id, "shop")}
                    disabled={feePayerLocked || feePayerSavingFor === o.sub_id}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium disabled:opacity-50 ${
                      o.delivery_fee_payer === "shop"
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    🏪 ร้านจ่าย
                  </button>
                </div>
                {feePayerLocked && <p className="text-[11px] text-gray-500">ล็อกผู้จ่ายแล้วหลังเลือก Rider เพื่อไม่ให้ข้อมูลเปลี่ยนกลางงาน</p>}
                {feePayerError[o.sub_id] && <p className="text-[11px] text-red-600">{feePayerError[o.sub_id]}</p>}
              </div>
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

              {o.fulfillment_type === "pickup" && (o.order_status === "confirmed" || o.order_status === "preparing") && (
                <button onClick={() => upd(o.sub_id, { order_status: "completed" })} className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5">ลูกค้ารับแล้ว ✓</button>
              )}

              {o.fulfillment_type === "delivery" && o.delivery_status === "needs_rider" && o.order_status !== "pending" && (
                <button
                  onClick={() => findNearbyRiders(o.sub_id)}
                  disabled={dispatching && candidateFor === o.sub_id}
                  className="rounded-lg bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5"
                >
                  {dispatching && candidateFor === o.sub_id ? "กำลังหา Rider..." : "📡 หา Rider ใกล้ร้าน"}
                </button>
              )}
              {o.fulfillment_type === "delivery" && o.delivery_status === "rider_called" && (() => {
                const riderContact = o.assigned_rider_id ? riderInfo[o.assigned_rider_id] : undefined;
                return (
                  <>
                    {riderContact && riderContact.phone && (
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

            {candidateFor === o.sub_id && o.delivery_status === "needs_rider" && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-2 mt-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-blue-800">Rider ที่กดสนใจงานนี้</p>
                  <button
                    onClick={() => refreshCandidates(o.sub_id)}
                    disabled={candidateLoading}
                    className="text-xs text-blue-600 disabled:opacity-50"
                  >
                    {candidateLoading ? "กำลังอัปเดต..." : "↻ อัปเดต"}
                  </button>
                </div>

                {dispatchMessage && <p className="text-xs text-blue-700">{dispatchMessage}</p>}
                {dispatchError && <p className="text-xs text-red-600">{dispatchError}</p>}

                {!dispatching && candidates.length === 0 && (
                  <p className="text-xs text-gray-500">ยังไม่มี Rider กดสนใจ ระบบจะอัปเดตให้อัตโนมัติทุก 5 วินาที</p>
                )}

                {candidates.map((candidate) => (
                  <div key={candidate.riderId} className="rounded-lg bg-white border border-blue-100 px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{candidate.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {candidate.vehicleType || "ไม่ระบุพาหนะ"}
                        {candidate.distanceKm != null ? ` · ${(candidate.distanceKm * 1000).toFixed(0)} ม.` : ""}
                        {candidate.online ? " · 🟢 Online" : " · ⚪ Offline"}
                      </p>
                    </div>
                    <button
                      onClick={() => chooseCandidate(o.sub_id, candidate)}
                      disabled={!!selectingRiderId}
                      className="shrink-0 rounded-lg bg-green-500 disabled:opacity-50 text-white text-xs px-3 py-1.5"
                    >
                      {selectingRiderId === candidate.riderId ? "กำลังเลือก..." : "เลือกคนนี้"}
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => findNearbyRiders(o.sub_id)}
                    disabled={dispatching}
                    className="flex-1 rounded-lg bg-blue-100 text-blue-700 text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    ส่งแจ้งเตือนอีกครั้ง
                  </button>
                  <button
                    onClick={() => { setCandidateFor(null); setCandidates([]); setDispatchMessage(null); setDispatchError(null); }}
                    className="px-3 text-xs text-gray-500"
                  >
                    ปิด
                  </button>
                </div>
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
