import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { cart, useCart, cartTotal } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { submitOrder } from "@/lib/order";

export const Route = createFileRoute("/cart")({
  component: CartCheckout,
});

function CartCheckout() {
  const c = useCart();
  const [shopName, setShopName] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (c.shopId) {
        const { data } = await supabase.from("shops").select("name").eq("shop_id", c.shopId).maybeSingle();
        setShopName((data as { name: string } | null)?.name ?? "");
      }
    })();
  }, [c.shopId]);

  async function confirm() {
    if (!c.shopId) return;
    if (fulfillment === "delivery" && !address.trim()) {
      setError("กรอกที่อยู่จัดส่ง");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await submitOrder({
      shopId: c.shopId,
      items: c.items.map((i) => ({ itemId: i.itemId, qty: i.qty })),
      fulfillment,
      payment: "cash",
      address: fulfillment === "delivery" ? address.trim() : null,
      note: note.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "สั่งไม่สำเร็จ");
      return;
    }
    cart.clear();
    setDone(true);
  }

  if (done)
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-2xl">✅</p>
        <p className="text-lg font-semibold">สั่งเรียบร้อย</p>
        <p className="text-sm text-gray-500">ร้านได้รับออเดอร์แล้ว จะแจ้งสถานะทาง LINE</p>
        <Link to="/" className="text-orange-500 underline block mt-2">กลับหน้าแรก</Link>
      </div>
    );

  if (c.items.length === 0)
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        ตะกร้าว่าง
        <Link to="/" className="text-orange-500 underline block mt-2">เลือกอาหาร</Link>
      </div>
    );

  return (
    <div className="p-4 pb-28 space-y-4 max-w-md mx-auto">
      <h1 className="text-lg font-bold">ยืนยันการสั่ง</h1>
      {shopName && <p className="text-sm text-gray-500">ร้าน {shopName}</p>}

      <div className="space-y-2 border-b border-gray-100 pb-3">
        {c.items.map((i) => (
          <div key={i.itemId} className="flex justify-between text-sm">
            <span className="truncate">{i.name} × {i.qty}</span>
            <span className="text-gray-600">฿{i.price * i.qty}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">รับสินค้า</p>
        <div className="flex gap-2">
          <button onClick={() => setFulfillment("delivery")} className={`flex-1 rounded-lg py-2 text-sm ${fulfillment === "delivery" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>ส่งถึงบ้าน</button>
          <button onClick={() => setFulfillment("pickup")} className={`flex-1 rounded-lg py-2 text-sm ${fulfillment === "pickup" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>รับเอง</button>
        </div>
        {fulfillment === "delivery" && (
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ที่อยู่จัดส่ง (บ้านเลขที่ / ซอย)" value={address} onChange={(e) => setAddress(e.target.value)} />
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-700 mb-1">ชำระเงิน</p>
        <p className="text-sm text-gray-600">💵 เก็บเงินปลายทาง (COD)</p>
      </div>

      <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="หมายเหตุถึงร้าน (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="fixed left-4 right-4 bottom-4">
        <button onClick={confirm} disabled={submitting} className="w-full rounded-xl bg-orange-500 text-white px-4 py-3 flex justify-between text-sm font-medium disabled:opacity-50">
          <span>{submitting ? "กำลังส่ง..." : "ยืนยันสั่ง"}</span>
          <span>฿{cartTotal(c)}</span>
        </button>
      </div>
    </div>
  );
}
