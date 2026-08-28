import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Legacy Web Rider compatibility view.
// Delivery state changes and customer delivery PII are intentionally unavailable
// here. Canonical Rider V3 operations live in Rider Native + authoritative Worker/DB flows.

type Job = {
  sub_id: string;
  shop_id: string;
  delivery_status: "rider_called" | "picked_up" | "delivered" | "failed" | string;
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
};

type Tab = "active" | "history";

const POLL_MS = 15_000;

function shopMapHref(input: { lat?: number | null; lng?: number | null; address?: string | null }) {
  if (input.lat != null && input.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${input.lat},${input.lng}`;
  }
  if (input.address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.address.trim())}`;
  }
  return null;
}

function statusLabel(status: string) {
  if (status === "rider_called") return "รับงานแล้ว · ไปรับของที่ร้าน";
  if (status === "picked_up") return "รับของแล้ว · กำลังนำส่ง";
  if (status === "delivered") return "ส่งสำเร็จ";
  if (status === "failed") return "ส่งไม่สำเร็จ / ปิดงาน";
  return status;
}

export function MyDeliveries() {
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const select =
      "sub_id,shop_id,delivery_status,delivery_photo_url,amount,created_at,shops(name,phone,address,lat,lng),order_items(item_name_snapshot,qty)";

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
    void load();
    const timer = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  const jobs = tab === "active" ? activeJobs : historyJobs;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
        <p className="font-semibold">Rider Delivery V3 ใช้งานผ่าน Rider App</p>
        <p>
          หน้านี้เก็บไว้สำหรับดูสถานะและประวัติแบบจำกัดข้อมูลเท่านั้น การรับงาน, Pickup, ข้อมูลจุดส่งลูกค้า และ Delivered + Proof ต้องทำผ่าน Rider Native
        </p>
      </div>

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
          <p className="text-sm font-medium text-gray-600">ยังไม่มีงาน Delivery V3 ที่ backend assign ให้คุณ</p>
          <p className="mt-1 text-xs text-gray-400">เมื่อคุณชนะ First Accept งานจะปรากฏที่นี่แบบอ่านอย่างเดียว</p>
        </div>
      )}

      {tab === "history" && historyJobs.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">ยังไม่มีประวัติงาน</p>
      )}

      {jobs.map((job) => {
        const shopMap = shopMapHref({ lat: job.shops?.lat, lng: job.shops?.lng, address: job.shops?.address });

        return (
          <div key={job.sub_id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{job.shops?.name ?? job.shop_id}</p>
                <p className={`mt-0.5 text-xs ${job.delivery_status === "delivered" ? "text-green-600" : job.delivery_status === "failed" ? "text-red-500" : "text-orange-600"}`}>
                  {statusLabel(job.delivery_status)}
                </p>
              </div>
              <span className="text-[11px] text-gray-400">
                {new Date(job.created_at).toLocaleString("th-TH", {
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
              {job.shops?.address && <p className="text-sm text-gray-700">📍 {job.shops.address}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {job.shops?.phone && (
                  <a href={`tel:${job.shops.phone}`} className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700">📞 โทรหาร้าน</a>
                )}
                {shopMap && (
                  <a href={shopMap} target="_blank" rel="noreferrer" className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700">🗺️ นำทางไปร้าน</a>
                )}
              </div>
            </div>

            {(job.delivery_status === "rider_called" || job.delivery_status === "picked_up") && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                ข้อมูลลูกค้าและจุดส่งไม่ถูกโหลดใน Web Rider กรุณาใช้ Rider App สำหรับงานปัจจุบัน
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-gray-500">สินค้า</p>
              <p className="mt-1 text-sm text-gray-700">{job.order_items.map((item) => `${item.item_name_snapshot} × ${item.qty}`).join(", ")}</p>
              <p className="mt-1 text-xs text-gray-400">ยอดสินค้า ฿{job.amount}</p>
            </div>

            {job.delivery_photo_url && (
              <div>
                <p className="mb-1 text-xs text-gray-500">📷 รูปยืนยันการส่ง</p>
                <img src={job.delivery_photo_url} alt="delivery proof" className="w-full max-h-52 rounded-lg object-cover" />
              </div>
            )}

            {(job.delivery_status === "rider_called" || job.delivery_status === "picked_up") && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500">
                การเปลี่ยนสถานะงานถูกล็อกบน Web Rider — ดำเนินการต่อใน Rider App
              </p>
            )}
          </div>
        );
      })}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
