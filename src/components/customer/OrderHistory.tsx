import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

// ============================================================
// MyTree — Customer order history + live status tracking.
// Shows: item list, order/payment/delivery status, rider info (once
// assigned), delivery proof photo, and — for QR-transfer orders — lets the
// customer attach a payment slip.
// ============================================================

type OrderRow = {
  sub_id: string;
  shop_id: string;
  fulfillment_type: "pickup" | "delivery";
  payment_method: "cash" | "qr_transfer";
  order_status: string;
  payment_status: string;
  delivery_status: string;
  delivery_address: string | null;
  delivery_photo_url: string | null;
  payment_slip_url: string | null;
  customer_note: string | null;
  amount: number;
  created_at: string;
  shops: { name: string } | null;
  order_items: { item_name_snapshot: string; qty: number; line_total: number }[];
  riders: { name: string; phone: string } | null;
};

const ORDER_LABEL: Record<string, string> = {
  pending: "รอร้านรับออเดอร์", confirmed: "ร้านรับออเดอร์แล้ว", preparing: "กำลังเตรียมอาหาร",
  completed: "เสร็จสิ้น", cancelled: "ยกเลิก",
};
const DELIVERY_LABEL: Record<string, string> = {
  not_needed: "รับเองที่ร้าน", needs_rider: "รอเรียกวิน", rider_called: "วินกำลังไปรับของ",
  picked_up: "วินรับของแล้ว กำลังส่ง", delivered: "ส่งถึงแล้ว", failed: "ส่งไม่สำเร็จ",
};

export function OrderHistory() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSubIdRef = useRef<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("sub_orders")
      .select(
        "sub_id, shop_id, fulfillment_type, payment_method, order_status, payment_status, delivery_status, delivery_address, delivery_photo_url, payment_slip_url, customer_note, amount, created_at, shops(name), order_items(item_name_snapshot,qty,line_total), riders:assigned_rider_id(name,phone)"
      )
      .order("created_at", { ascending: false })
      .limit(30);
    setOrders((data as unknown as OrderRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openSlipPicker(sub_id: string) {
    pendingSubIdRef.current = sub_id;
    fileInputRef.current?.click();
  }

  async function onSlipChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const sub_id = pendingSubIdRef.current;
    e.target.value = "";
    if (!file || !sub_id) return;

    setUploadingFor(sub_id);
    setError(null);
    try {
      const path = `${sub_id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("payment-slips")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("payment-slips").getPublicUrl(path);
      const { error: updErr } = await supabase.from("sub_orders").update({ payment_slip_url: pub.publicUrl }).eq("sub_id", sub_id);
      if (updErr) throw updErr;
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "แนบสลิปไม่สำเร็จ");
    } finally {
      setUploadingFor(null);
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  if (orders.length === 0)
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        ยังไม่มีประวัติออเดอร์
        <Link to="/" className="text-orange-500 underline block mt-2">เริ่มสั่งอาหาร</Link>
      </div>
    );

  return (
    <div className="p-4 pb-8 space-y-3 max-w-md mx-auto">
      <h1 className="text-lg font-bold">📋 ประวัติออเดอร์</h1>
      {orders.map((o) => (
        <div key={o.sub_id} className="rounded-xl border border-gray-200 p-3 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium">{o.shops?.name ?? o.shop_id}</p>
              <p className="text-xs text-gray-400">
                {new Date(o.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <span className={`text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap ${
              o.order_status === "completed" ? "bg-green-100 text-green-700" :
              o.order_status === "cancelled" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
            }`}>
              {ORDER_LABEL[o.order_status] ?? o.order_status}
            </span>
          </div>

          <div className="text-sm text-gray-600">
            {o.order_items.map((i, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{i.item_name_snapshot} × {i.qty}</span>
                <span>฿{i.line_total}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-medium border-t border-gray-100 pt-1">
            <span>รวม</span><span>฿{o.amount}</span>
          </div>

          {o.customer_note && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">📝 {o.customer_note}</p>
          )}

          {o.fulfillment_type === "delivery" && (
            <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-700 space-y-0.5">
              <p>🛵 {DELIVERY_LABEL[o.delivery_status] ?? o.delivery_status}</p>
              {o.delivery_address && <p className="text-gray-500">📍 {o.delivery_address}</p>}
              {o.riders && (
                <p className="pt-1">
                  วินที่มาส่ง: <span className="font-medium">{o.riders.name}</span>{" "}
                  {(o.delivery_status === "rider_called" || o.delivery_status === "picked_up") && (
                    <a href={`tel:${o.riders.phone}`} className="underline">📞 {o.riders.phone}</a>
                  )}
                </p>
              )}
              {o.delivery_photo_url && (
                <div className="pt-1">
                  <p className="text-gray-500 mb-1">📷 รูปยืนยันส่งของ</p>
                  <img src={o.delivery_photo_url} alt="delivery proof" className="w-full rounded-lg object-cover" />
                </div>
              )}
            </div>
          )}

          {o.payment_method === "qr_transfer" ? (
            <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-700 space-y-1">
              <p>💳 {o.payment_status === "paid" ? "✅ ร้านยืนยันรับเงินแล้ว" : o.payment_slip_url ? "⏳ รอร้านยืนยันรับเงิน" : "ยังไม่ได้แนบสลิป"}</p>
              {o.payment_slip_url && (
                <img src={o.payment_slip_url} alt="payment slip" className="w-32 rounded-lg object-cover" />
              )}
              {o.payment_status !== "paid" && !o.payment_slip_url && (
                <button
                  onClick={() => openSlipPicker(o.sub_id)}
                  disabled={uploadingFor === o.sub_id}
                  className="rounded-lg bg-purple-500 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  {uploadingFor === o.sub_id ? "กำลังส่ง..." : "📎 แนบสลิปโอนเงิน"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              {o.payment_status === "paid" ? "✅ ชำระเงินแล้ว" : "💵 เก็บเงินปลายทาง — ยังไม่ชำระ"}
            </p>
          )}
        </div>
      ))}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onSlipChosen} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
