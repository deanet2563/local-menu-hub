import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// MyTree — "งานของฉัน" — rider self-serves their assigned deliveries:
// รับของแล้ว (rider_called -> picked_up) then ส่งสำเร็จ + ถ่ายรูปยืนยัน
// (picked_up -> delivered, photo required). Photo uploads to the
// `delivery-proofs` public bucket; RLS only allows the assigned rider to
// upload into their own order's folder (see fn_is_my_assigned_delivery).
// ============================================================

type Job = {
  sub_id: string;
  shop_id: string;
  delivery_status: string;
  delivery_address: string | null;
  amount: number;
  shops: { name: string } | null;
  order_items: { item_name_snapshot: string; qty: number }[];
  hub_orders: { customers: { name: string | null; phone: string | null } | null } | null;
};

export function MyDeliveries() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSubIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sub_orders")
      .select("sub_id,shop_id,delivery_status,delivery_address,amount,shops(name),order_items(item_name_snapshot,qty),hub_orders(customers(name,phone))")
      .in("delivery_status", ["rider_called", "picked_up"])
      .order("created_at", { ascending: true });
    setJobs((data as unknown as Job[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function pickedUp(sub_id: string) {
    setError(null);
    const { error } = await supabase.from("sub_orders").update({ delivery_status: "picked_up" }).eq("sub_id", sub_id);
    if (error) setError(error.message);
    load();
  }

  function openCamera(sub_id: string) {
    pendingSubIdRef.current = sub_id;
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const sub_id = pendingSubIdRef.current;
    e.target.value = ""; // allow re-selecting the same file later
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

      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ถ่ายรูป/ส่งงานไม่สำเร็จ");
    } finally {
      setUploadingFor(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">📦 งานของฉัน ({jobs.length})</p>
      {jobs.length === 0 && <p className="text-xs text-gray-400">ยังไม่มีงานที่ต้องส่ง</p>}

      {jobs.map((j) => (
        <div key={j.sub_id} className="rounded-lg border border-gray-200 p-3 space-y-1">
          <p className="text-sm font-medium">{j.shops?.name ?? j.shop_id}</p>
          {j.hub_orders?.customers && (
            <p className="text-xs text-gray-600">
              👤 {j.hub_orders.customers.name || "(ไม่มีชื่อ)"}
              {j.hub_orders.customers.phone && (
                <> · <a href={`tel:${j.hub_orders.customers.phone}`} className="underline">📞 {j.hub_orders.customers.phone}</a></>
              )}
            </p>
          )}
          <p className="text-xs text-gray-500">
            {j.order_items.map((i) => `${i.item_name_snapshot}×${i.qty}`).join(", ")} — ฿{j.amount}
          </p>
          {j.delivery_address && <p className="text-xs text-gray-400">📍 {j.delivery_address}</p>}

          {j.delivery_status === "rider_called" && (
            <button onClick={() => pickedUp(j.sub_id)} className="rounded-lg bg-orange-500 text-white text-xs px-3 py-1.5 mt-1">
              รับของแล้ว
            </button>
          )}
          {j.delivery_status === "picked_up" && (
            <button
              onClick={() => openCamera(j.sub_id)}
              disabled={uploadingFor === j.sub_id}
              className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5 mt-1 disabled:opacity-50"
            >
              {uploadingFor === j.sub_id ? "กำลังส่ง..." : "📷 ถ่ายรูป ส่งสำเร็จ"}
            </button>
          )}
        </div>
      ))}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChosen} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
