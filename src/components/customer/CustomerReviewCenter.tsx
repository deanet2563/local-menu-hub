import { useEffect, useMemo, useState } from "react";
import { getCurrentCustomerId, supabase } from "@/lib/supabase";

type EligibleOrder = {
  sub_id: string;
  shop_id: string;
  order_status: string;
  fulfillment_type: "pickup" | "delivery";
  delivery_status: string;
  created_at: string;
  shops: { name: string } | null;
};

type ExistingReview = { sub_id: string };

export function CustomerReviewCenter() {
  const [orders, setOrders] = useState<EligibleOrder[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [rating, setRating] = useState<Record<string, number>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setError(null);
    try {
      const { data, error: orderError } = await supabase
        .from("sub_orders")
        .select("sub_id,shop_id,order_status,fulfillment_type,delivery_status,created_at,shops(name)")
        .eq("order_status", "completed")
        .order("created_at", { ascending: false })
        .limit(30);
      if (orderError) throw orderError;
      const rows = (data as unknown as EligibleOrder[] | null) ?? [];
      const eligible = rows.filter((order) => order.fulfillment_type === "pickup" || order.delivery_status === "delivered");
      setOrders(eligible);

      if (eligible.length) {
        const { data: reviews, error: reviewError } = await supabase
          .from("shop_order_reviews")
          .select("sub_id")
          .in("sub_id", eligible.map((order) => order.sub_id));
        if (reviewError) throw reviewError;
        setReviewed(new Set(((reviews as ExistingReview[] | null) ?? []).map((review) => review.sub_id)));
      } else {
        setReviewed(new Set());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดรายการรีวิวไม่สำเร็จ");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { void load(); }, []);

  const pending = useMemo(() => orders.filter((order) => !reviewed.has(order.sub_id)), [orders, reviewed]);
  if (!loaded) return null;
  if (!pending.length && !error) return null;

  async function submit(order: EligibleOrder) {
    const stars = rating[order.sub_id] ?? 0;
    if (stars < 1 || stars > 5) return setError("กรุณาเลือกคะแนน 1–5 ดาว");
    const customerId = await getCurrentCustomerId();
    if (!customerId) return setError("กรุณาเปิด MyTree ผ่าน LINE ก่อนรีวิว");

    setSaving(order.sub_id); setError(null);
    try {
      const { error: insertError } = await supabase.from("shop_order_reviews").insert({
        sub_id: order.sub_id,
        shop_id: order.shop_id,
        customer_id: customerId,
        rating: stars,
        review_text: text[order.sub_id]?.trim() || null,
        is_verified_order: true,
      });
      if (insertError) throw insertError;
      setReviewed((current) => new Set([...current, order.sub_id]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ส่งรีวิวไม่สำเร็จ");
    } finally { setSaving(null); }
  }

  return <section className="mx-4 mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 space-y-3">
    <div>
      <p className="font-semibold text-gray-800">⭐ รีวิวร้านจากออเดอร์จริง</p>
      <p className="mt-1 text-xs text-gray-500">รีวิวส่งได้ครั้งเดียวและแก้ไขภายหลังไม่ได้ กรุณาตรวจสอบก่อนส่ง</p>
    </div>
    {error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}
    {pending.map((order) => <div key={order.sub_id} className="rounded-xl border border-amber-100 bg-white p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-gray-800">{order.shops?.name ?? "ร้าน MyTree"}</p><p className="text-[11px] text-gray-400">Order #{order.sub_id.slice(0, 6).toUpperCase()}</p></div>
        <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700">✓ Verified Order</span>
      </div>
      <div className="flex gap-1" aria-label="เลือกคะแนนร้าน">
        {[1,2,3,4,5].map((star) => <button key={star} type="button" onClick={() => setRating((current) => ({ ...current, [order.sub_id]: star }))} className={`text-2xl ${star <= (rating[order.sub_id] ?? 0) ? "text-amber-400" : "text-gray-200"}`}>★</button>)}
      </div>
      <textarea value={text[order.sub_id] ?? ""} onChange={(event) => setText((current) => ({ ...current, [order.sub_id]: event.target.value }))} maxLength={3000} rows={3} placeholder="เขียนรีวิวร้าน (ไม่บังคับ)" className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm" />
      <button type="button" disabled={saving === order.sub_id} onClick={() => void submit(order)} className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving === order.sub_id ? "กำลังส่ง…" : "ส่งรีวิว"}</button>
    </div>)}
  </section>;
}
