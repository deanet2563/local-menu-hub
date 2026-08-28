import { useState } from "react";
import { supabase } from "@/lib/supabase";

export const CUSTOMER_RIDER_V3_ENABLED = import.meta.env.VITE_ENABLE_RIDER_DELIVERY_V3 === "true";

type Props = {
  subId: string;
  onCancelled: () => Promise<void>;
};

type CancelRow = {
  result?: string;
  sub_id?: string;
};

export function CustomerDeliveryCancel({ subId, onCancelled }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!CUSTOMER_RIDER_V3_ENABLED) return null;

  async function cancel() {
    if (busy) return;
    const normalized = reason.trim();
    if (!normalized) {
      setError("กรุณาระบุเหตุผลที่ต้องการยกเลิก");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("fn_customer_cancel_delivery_v3", {
        p_sub_id: subId,
        p_reason: normalized.slice(0, 500),
      });
      if (rpcError) throw rpcError;

      const row = (Array.isArray(data) ? data[0] : data) as CancelRow | null;
      if (!row || (row.result !== "cancelled" && row.result !== "already_cancelled")) {
        throw new Error("ระบบไม่สามารถยืนยันผลการยกเลิกได้");
      }

      setMessage(row.result === "already_cancelled" ? "ออเดอร์นี้ถูกยกเลิกแล้ว" : "ยกเลิกออเดอร์แล้ว");
      await onCancelled();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "ยกเลิกออเดอร์ไม่สำเร็จ";
      if (text.includes("cancellation_not_allowed_after_pickup")) {
        setError("ยกเลิกไม่ได้ เพราะ Rider รับสินค้าไปแล้ว");
      } else if (text.includes("cancellation_reason_required")) {
        setError("กรุณาระบุเหตุผลที่ต้องการยกเลิก");
      } else if (text.includes("delivery_not_owned_by_customer")) {
        setError("ไม่มีสิทธิ์ยกเลิกออเดอร์นี้");
      } else {
        setError(text);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-red-700">ยกเลิกการจัดส่งก่อน Rider รับสินค้า</p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        disabled={busy}
        rows={2}
        placeholder="ระบุเหตุผลที่ต้องการยกเลิก"
        className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-red-400 disabled:opacity-60"
      />
      <button
        type="button"
        disabled={busy || !reason.trim()}
        onClick={() => void cancel()}
        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        {busy ? "กำลังยกเลิก..." : "ยืนยันยกเลิกออเดอร์"}
      </button>
      <p className="text-[11px] text-red-600">การยกเลิกนี้ไม่คืนเงินอัตโนมัติ การคืนเงินเป็นไปตามขั้นตอนการชำระเงินของร้าน</p>
      {message && <p className="text-xs font-medium text-green-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
