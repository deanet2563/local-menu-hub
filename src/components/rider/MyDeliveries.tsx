import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// MyTree — Rider Delivery Flow
//
// IMPORTANT:
// - This remains a directory/manual-assignment model. Riders only see jobs
//   already assigned to them by a shop; there is no claim/auto-dispatch flow.
// - Existing order creation / checkout flow is untouched.
// - Rider status transitions remain protected by DB/RLS/trigger rules:
//   rider_called -> picked_up -> delivered (photo required for delivered).
// ============================================================

type Job = {
  sub_id: string;
  shop_id: string;
  delivery_status: "rider_called" | "picked_up" | "delivered" | "failed" | string;
  delivery_address: string | null;
  delivery_photo_url: string | null;
  amount: number;
  created_at: string;
  shops: {
    name: string;
    phone: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  order_items: { item_name_snapshot: string; qty: number }[];
  hub_orders: { customers: { name: string | null; phone: string | null } | null } | null;
};

type Tab = "active" | "history";

const POLL_MS = 15_000;

function mapHref(input: { lat?: number | null; lng?: number | null; address?: string | null }) {
  if (input.lat != null && input.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${input.lat},${input.lng}`;
  }
  if (input.address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.address.trim())}`;
  }
  return null;
}

function statusLabel(status: string) {
  if (status === "rider_called") return "งานใหม่ · ไปรับของที่ร้าน";
  if (status === "picked_up") return "รับของแล้ว · กำลังนำส่ง";
  if (status === "delivered") return "ส่งสำเร็จ";
  if (status === "failed") return "ส่งไม่สำเร็จ";
  return status;
}

export function MyDeliveries() {
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSubIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const select =
      "sub_id,shop_id,delivery_status,delivery_address,delivery_photo_url,amount,created_at,shops(name,phone,address,lat,lng),order_items(item_name_snapshot,qty),hub_orders(customers(name,phone))";

    const [{ data: active, error: activeError }, { data: history, error: historyError }] = await Promise.all([
      supabase
        .from("sub_orders")
        .select(select)
        .in("delivery_status", ["rider_called", "picked_up"])
        .order("created_at", { ascending: true }),
      supabase
        .from("sub_orders")
        .select(select)
        .in("delivery_status", ["delivered", "failed"])
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (activeError || historyError) {
      setError(activeError?.message || historyError?.message || "โหลดงานไม่สำเร็จ");
    } else {
      setError(null);
    }

    setActiveJobs((active as unknown as Job[]) ?? []);
    setHistoryJobs((history as unknown as Job[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function pickedUp(sub_id: string) {
    setError(null);
    const { error } = await supabase.from("sub_orders").update({ delivery_status: "picked_up" }).eq("sub_id", sub_id);
    if (error) setError(error.message);
    await load();
  }

  function openCamera(sub_id: string) {
    pendingSubIdRef.current = sub_id;
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const sub_id = pendingSubIdRef.current;
    e.target.value = "";
    if (!file || !sub_id) return;

    setUploadingFor(sub_id);
    setError(null);
    try {
      const path = `${sub_id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("delivery-proofs")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("delivery-proofs").getPublicUrl(path);

      const { error: updErr } = await supabase
        .from("sub_orders")
        .update({ delivery_status: "delivered", delivery_photo_url: pub.publicUrl })
        .eq("sub_id", sub_id);
      if (updErr) throw updErr;

      setTab("history");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ถ่ายรูป/ส่งงานไม่สำเร็จ");
    } finally {
      setUploadingFor(null);
      pendingSubIdRef.current = null;
    }
  }

  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  const jobs = tab === "active" ? activeJobs : historyJobs;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-1 grid grid-cols-2 gap-1">
        <button
          onClick={() => setTab("active")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "active" ? "bg-orange-500 text-white" : "text-gray-500"}`}
        >
          งานปัจจุบัน ({activeJobs.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "history" ? "bg-gray-800 text-white" : "text-gray-500"}`}
        >
          ประวัติงาน ({historyJobs.length})
        </button>
      </div>

      {tab === "active" && activeJobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center">
          <p className="text-sm font-medium text-gray-600">ยังไม่มีงานที่ร้านมอบหมาย</p>
          <p className="mt-1 text-xs text-gray-400">เมื่อร้านเลือกคุณจากรายชื่อวิน งานจะปรากฏที่หน้านี้</p>
        </div>
      )}

      {tab === "history" && historyJobs.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">ยังไม่มีประวัติงาน</p>
      )}

      {jobs.map((j) => {
        const customer = j.hub_orders?.customers;
        const shopMap = mapHref({ lat: j.shops?.lat, lng: j.shops?.lng, address: j.shops?.address });
        const customerMap = mapHref({ address: j.delivery_address });
        const isActive = j.delivery_status === "rider_called" || j.delivery_status === "picked_up";

        return (
          <div key={j.sub_id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{j.shops?.name ?? j.shop_id}</p>
                <p className={`mt-0.5 text-xs ${j.delivery_status === "delivered" ? "text-green-600" : j.delivery_status === "failed" ? "text-red-500" : "text-orange-600"}`}>
                  {statusLabel(j.delivery_status)}
                </p>
              </div>
              <span className="text-[11px] text-gray-400">
                {new Date(j.created_at).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 space-y-1.5">
              <p className="text-xs font-medium text-gray-500">จุดรับสินค้า</p>
              {j.shops?.address && <p className="text-sm text-gray-700">📍 {j.shops.address}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {j.shops?.phone && (
                  <a href={`tel:${j.shops.phone}`} className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700">
                    📞 โทรหาร้าน
                  </a>
                )}
                {shopMap && (
                  <a href={shopMap} target="_blank" rel="noreferrer" className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700">
                    🗺️ นำทางไปร้าน
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-blue-50/60 p-3 space-y-1.5">
              <p className="text-xs font-medium text-blue-700">จุดส่ง</p>
              <p className="text-sm text-gray-700">👤 {customer?.name || "ลูกค้า"}</p>
              {j.delivery_address && <p className="text-sm text-gray-700">📍 {j.delivery_address}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {customer?.phone && (
                  <a href={`tel:${customer.phone}`} className="rounded-lg bg-white border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
                    📞 โทรหาลูกค้า
                  </a>
                )}
                {customerMap && (
                  <a href={customerMap} target="_blank" rel="noreferrer" className="rounded-lg bg-white border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
                    🗺️ นำทางไปจุดส่ง
                  </a>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">สินค้า</p>
              <p className="mt-1 text-sm text-gray-700">{j.order_items.map((i) => `${i.item_name_snapshot} × ${i.qty}`).join(", ")}</p>
              <p className="mt-1 text-xs text-gray-400">ยอดสินค้า ฿{j.amount}</p>
            </div>

            {j.delivery_photo_url && (
              <div>
                <p className="mb-1 text-xs text-gray-500">📷 รูปยืนยันการส่ง</p>
                <img src={j.delivery_photo_url} alt="delivery proof" className="w-full max-h-52 rounded-lg object-cover" />
              </div>
            )}

            {isActive && (
              <div className="border-t border-gray-100 pt-3">
                {j.delivery_status === "rider_called" && (
                  <button onClick={() => pickedUp(j.sub_id)} className="w-full rounded-lg bg-orange-500 text-white text-sm font-medium px-3 py-2.5">
                    ✅ รับสินค้าแล้ว — เริ่มนำส่ง
                  </button>
                )}
                {j.delivery_status === "picked_up" && (
                  <button
                    onClick={() => openCamera(j.sub_id)}
                    disabled={uploadingFor === j.sub_id}
                    className="w-full rounded-lg bg-green-500 text-white text-sm font-medium px-3 py-2.5 disabled:opacity-50"
                  >
                    {uploadingFor === j.sub_id ? "กำลังอัปโหลดรูป..." : "📷 ส่งสำเร็จ — ถ่ายรูปยืนยัน"}
                  </button>
                )}
                <p className="mt-2 text-[11px] text-gray-400 text-center">
                  ระบบจะเปลี่ยนสถานะตามลำดับเท่านั้น และต้องมีรูปก่อนปิดงานว่าส่งสำเร็จ
                </p>
              </div>
            )}
          </div>
        );
      })}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChosen} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
