// ============================================================
// Local Menu Hub — Step 15: Manual Rider Delivery Flow (Shop UI)
//
// วาง DeliveryStatusPanel ใน Shop Order Detail page: src/routes/shop/orders/$subId.tsx
// วาง DeliveryQueueList ใน Shop Order List page: src/routes/shop/orders/index.tsx
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { DeliveryStatusEnum } from "@/types/database";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type DeliveryStatus = DeliveryStatusEnum;

type RiderContact = {
  id: string;
  rider_name: string | null;
  phone: string;
  is_default: boolean;
};

type SubOrderDelivery = {
  sub_id: string;
  shop_id: string;
  delivery_status: DeliveryStatus;
  delivery_address: string | null;
  rider_called_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  delivery_failed_reason: string | null;
  rider_retry_count: number;
};

const FAILURE_REASONS = [
  "วินไม่มา",
  "ลูกค้าติดต่อไม่ได้",
  "ที่อยู่ผิด/หาไม่เจอ",
  "อื่นๆ",
] as const;

// ----------------------------------------------------------------
// Helper: copy ที่อยู่ลูกค้า + เปิด tel: link ไปเบอร์วินที่เลือก
// ----------------------------------------------------------------

async function copyAddressAndCallRider(address: string | null, phone: string) {
  if (address) {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // เบราว์เซอร์บางตัว/บางสิทธิ์ copy ไม่ได้ — ไม่ critical พอ ไม่ต้อง throw
    }
  }
  window.location.href = `tel:${phone}`;
}

// ----------------------------------------------------------------
// DeliveryStatusPanel — แสดงใน Shop Order Detail
// ----------------------------------------------------------------

export function DeliveryStatusPanel({ subId }: { subId: string }) {
  const [order, setOrder] = useState<SubOrderDelivery | null>(null);
  const [riderContacts, setRiderContacts] = useState<RiderContact[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("");
  const [showFailureReasons, setShowFailureReasons] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    const { data, error } = await supabase
      .from("sub_orders")
      .select(
        "sub_id, shop_id, delivery_status, delivery_address, rider_called_at, picked_up_at, delivered_at, delivery_failed_reason, rider_retry_count"
      )
      .eq("sub_id", subId)
      .single();

    if (error) {
      setError(error.message);
      return;
    }
    setOrder(data as unknown as SubOrderDelivery);

    if (data?.shop_id) {
      const { data: contacts } = await supabase
        .from("shop_rider_contacts")
        .select("id, rider_name, phone, is_default")
        .eq("shop_id", data.shop_id)
        .order("sort_order", { ascending: true });

      setRiderContacts(contacts ?? []);
      const defaultContact = contacts?.find((c) => c.is_default);
      if (defaultContact) setSelectedRiderId(defaultContact.id);
    }
  }, [subId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  async function updateStatus(
    next: DeliveryStatus,
    extra: Record<string, unknown> = {}
  ) {
    setLoading(true);
    setError(null);
    const { error } = await supabase
      .from("sub_orders")
      .update({ delivery_status: next, ...extra })
      .eq("sub_id", subId);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    await loadOrder();
  }

  async function handleCallRider() {
    const contact = riderContacts.find((c) => c.id === selectedRiderId);
    if (!contact) {
      setError("กรุณาเลือกเบอร์วินก่อนกด");
      return;
    }
    await copyAddressAndCallRider(order?.delivery_address ?? null, contact.phone);
    await updateStatus("rider_called", { rider_contact_id: contact.id });
  }

  async function handleFailure(reason: string) {
    await updateStatus("failed", { delivery_failed_reason: reason });
    setShowFailureReasons(false);
  }

  if (!order) return <div className="text-sm text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">🚚 การจัดส่ง</h3>
        <StatusBadge status={order.delivery_status} />
      </div>

      {order.delivery_address && (
        <p className="text-sm text-gray-500">ที่อยู่: {order.delivery_address}</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* needs_rider — เลือกเบอร์วิน + กดเรียก */}
      {order.delivery_status === "needs_rider" && (
        <div className="space-y-2">
          <select
            className="w-full rounded-lg border border-gray-300 p-2 text-sm"
            value={selectedRiderId}
            onChange={(e) => setSelectedRiderId(e.target.value)}
          >
            <option value="">— เลือกเบอร์วิน —</option>
            {riderContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rider_name ?? "ไม่มีชื่อ"} ({c.phone}) {c.is_default ? "★" : ""}
              </option>
            ))}
          </select>
          {riderContacts.length === 0 && (
            <p className="text-xs text-amber-600">
              ยังไม่มีเบอร์วินบันทึกไว้ — ไปเพิ่มที่หน้าตั้งค่าการส่งก่อน (สูงสุด 5 เบอร์)
            </p>
          )}
          <ActionButton
            label="📞 เรียกวิน"
            onClick={handleCallRider}
            disabled={loading || !selectedRiderId}
            primary
          />
          <p className="text-xs text-gray-400">
            กดแล้วจะ copy ที่อยู่ลูกค้า + เปิดโทรออกให้อัตโนมัติ
            — ระบบไม่ได้สั่งวินจริง คุณต้องคุยกับวินเองทางโทรศัพท์
          </p>
        </div>
      )}

      {/* rider_called */}
      {order.delivery_status === "rider_called" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            🛵 เรียกวินแล้ว {formatTime(order.rider_called_at)}
          </p>
          <div className="flex gap-2">
            <ActionButton
              label="✅ วินรับของแล้ว"
              onClick={() => updateStatus("picked_up")}
              disabled={loading}
              primary
            />
            <ActionButton
              label="❌ มีปัญหา"
              onClick={() => setShowFailureReasons(true)}
              disabled={loading}
            />
          </div>
        </div>
      )}

      {/* picked_up */}
      {order.delivery_status === "picked_up" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            📦 วินรับของแล้ว {formatTime(order.picked_up_at)}
          </p>
          <div className="flex gap-2">
            <ActionButton
              label="✅ ส่งสำเร็จ"
              onClick={() => updateStatus("delivered")}
              disabled={loading}
              primary
            />
            <ActionButton
              label="❌ ส่งไม่สำเร็จ"
              onClick={() => setShowFailureReasons(true)}
              disabled={loading}
            />
          </div>
          <p className="text-xs text-amber-600">
            ⚠️ ของออกจากร้านไปแล้ว — ถ้าต้องยกเลิก/คืนเงินหลังจุดนี้ ร้านต้องจัดการเอง
            ระบบจะไม่ให้ refund อัตโนมัติ (ต้องระบุเหตุผลก่อนเสมอ)
          </p>
        </div>
      )}

      {/* delivered */}
      {order.delivery_status === "delivered" && (
        <p className="text-sm text-green-600">
          ✅ ส่งถึงลูกค้าแล้ว {formatTime(order.delivered_at)}
        </p>
      )}

      {/* failed */}
      {order.delivery_status === "failed" && (
        <div className="space-y-2">
          <p className="text-sm text-red-500">
            ❌ มีปัญหา — เหตุผล: {order.delivery_failed_reason ?? "ไม่ระบุ"}
            {order.rider_retry_count > 0 && (
              <span className="text-gray-400"> (retry มาแล้ว {order.rider_retry_count} ครั้ง)</span>
            )}
          </p>
          <div className="flex gap-2">
            <ActionButton
              label="🔄 เรียกวินใหม่"
              onClick={() => updateStatus("needs_rider")}
              disabled={loading}
              primary
            />
            <ActionButton
              label="🚫 ยกเลิกออเดอร์"
              onClick={() => {
                if (
                  confirm(
                    "ยืนยันยกเลิกออเดอร์นี้? วินอาจกำลังเดินทางมา ระบบไม่สามารถแจ้งวินยกเลิกอัตโนมัติได้ กรุณาโทรแจ้งวินด้วยตัวเอง"
                  )
                ) {
                  // หมายเหตุ: cancel order_status จริงทำผ่าน order-status mutation
                  // แยกอีกฟังก์ชันหนึ่ง (ไม่ใช่ delivery_status) — เชื่อมกับ business
                  // logic ของ order cancellation flow ที่มีอยู่แล้ว
                  console.warn("TODO: call order-cancellation mutation, sub_id =", subId);
                }
              }}
              disabled={loading}
            />
          </div>
        </div>
      )}

      {/* Failure reason picker (modal-ish, แบบ inline ง่ายๆ) */}
      {showFailureReasons && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50">
          <p className="text-sm font-medium">เลือกเหตุผล:</p>
          {FAILURE_REASONS.map((reason) => (
            <button
              key={reason}
              className="block w-full text-left text-sm rounded-md px-3 py-2 hover:bg-gray-100"
              onClick={() => handleFailure(reason)}
            >
              {reason}
            </button>
          ))}
          <button
            className="text-xs text-gray-400 underline"
            onClick={() => setShowFailureReasons(false)}
          >
            ยกเลิก
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// DeliveryQueueList — แสดงใน Shop Order List (ดูรวมหลายออเดอร์พร้อมกัน)
// ใช้ view `shop_delivery_queue` ที่สร้างไว้ใน phase1_step15_rider_delivery_addon.sql
// ----------------------------------------------------------------

type QueueRow = {
  sub_id: string;
  order_id: string;
  shop_name: string;
  delivery_status: DeliveryStatus;
  confirmed_at: string | null;
  rider_called_at: string | null;
  picked_up_at: string | null;
};

export function DeliveryQueueList({ shopId }: { shopId: string }) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("shop_delivery_queue")
      .select("sub_id, order_id, shop_name, delivery_status, confirmed_at, rider_called_at, picked_up_at")
      .eq("shop_id", shopId);
    setRows(data ?? []);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    load();
    // Realtime: ฟังการเปลี่ยนแปลง sub_orders ของร้านนี้ ให้ queue อัปเดตสด
    const channel = supabase
      .channel(`delivery-queue-${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sub_orders", filter: `shop_id=eq.${shopId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, load]);

  if (loading) return <div className="text-sm text-gray-400">กำลังโหลด...</div>;
  if (rows.length === 0)
    return <p className="text-sm text-gray-400">ไม่มีออเดอร์ที่รอจัดส่งตอนนี้</p>;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-800">🚚 ออเดอร์ที่รอจัดส่ง ({rows.length})</h3>
      {rows.map((row) => (
        <div
          key={row.sub_id}
          className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
        >
          <div>
            <p className="text-sm font-medium">#{row.order_id.slice(0, 6)}</p>
            <StatusBadge status={row.delivery_status} small />
          </div>
          <a
            href={`/sweet/orders/${row.sub_id}`}
            className="text-sm text-blue-600 underline"
          >
            เปิดดู →
          </a>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Small shared UI bits
// ----------------------------------------------------------------

function StatusBadge({ status, small }: { status: DeliveryStatus; small?: boolean }) {
  const map: Record<DeliveryStatus, { label: string; color: string }> = {
    not_needed: { label: "ไม่ต้องส่ง", color: "bg-gray-100 text-gray-500" },
    needs_rider: { label: "🟡 รอเรียกวิน", color: "bg-yellow-100 text-yellow-700" },
    rider_called: { label: "🛵 เรียกวินแล้ว", color: "bg-blue-100 text-blue-700" },
    picked_up: { label: "📦 วินรับของแล้ว", color: "bg-indigo-100 text-indigo-700" },
    delivered: { label: "✅ ส่งถึงแล้ว", color: "bg-green-100 text-green-700" },
    failed: { label: "❌ มีปัญหา", color: "bg-red-100 text-red-700" },
  };
  const { label, color } = map[status];
  return (
    <span
      className={`inline-block rounded-full px-2 py-1 ${small ? "text-xs" : "text-sm"} font-medium ${color}`}
    >
      {label}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
        primary ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}
