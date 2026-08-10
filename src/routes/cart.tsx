import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { cart, useCart, cartLineTotal, cartTotal } from "@/lib/cart";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { submitOrder } from "@/lib/order";

export const Route = createFileRoute("/cart")({ component: CartCheckout });

type ShopCheckout = {
  name: string;
  delivery_enabled: boolean | null;
  pickup_enabled: boolean | null;
  payment_cash_enabled: boolean;
  payment_qr_enabled: boolean;
  qr_code_url: string | null;
  accepts_preorders: boolean;
};

function CartCheckout() {
  const c = useCart();
  const [shop, setShop] = useState<ShopCheckout | null>(null);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = useState<"cash" | "qr_transfer">("cash");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!c.shopId) return;
      const { data } = await supabase
        .from("shops")
        .select("name,delivery_enabled,pickup_enabled,payment_cash_enabled,payment_qr_enabled,qr_code_url,accepts_preorders")
        .eq("shop_id", c.shopId)
        .maybeSingle();
      const row = data as ShopCheckout | null;
      setShop(row);
      if (row?.delivery_enabled === false && row.pickup_enabled !== false) setFulfillment("pickup");
      if (!row?.payment_cash_enabled && row?.payment_qr_enabled) setPayment("qr_transfer");
    })();
  }, [c.shopId]);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) return;
        const { data } = await supabase.from("customers").select("name,phone").eq("id", cid).maybeSingle();
        const row = data as { name: string | null; phone: string | null } | null;
        if (row?.name) setCustomerName(row.name);
        if (row?.phone) setCustomerPhone(row.phone);
      } catch {
        /* fields remain editable */
      }
    })();
  }, []);

  async function confirm() {
    if (!c.shopId) return;
    if (!customerName.trim() || !customerPhone.trim()) return setError("กรอกชื่อและเบอร์โทรก่อนสั่ง");
    if (fulfillment === "delivery" && !address.trim()) return setError("กรอกที่อยู่จัดส่ง");
    if (fulfillment === "delivery" && shop?.delivery_enabled === false) return setError("ร้านนี้ไม่เปิดบริการจัดส่ง");
    if (fulfillment === "pickup" && shop?.pickup_enabled === false) return setError("ร้านนี้ไม่เปิดบริการรับเอง");
    if (payment === "cash" && shop && !shop.payment_cash_enabled) return setError("ร้านนี้ไม่รับเงินสด");
    if (payment === "qr_transfer" && shop && !shop.payment_qr_enabled) return setError("ร้านนี้ไม่รับชำระผ่าน QR");

    setSubmitting(true);
    setError(null);

    const cid = await getCurrentCustomerId();
    if (cid) {
      await supabase.from("customers").update({ name: customerName.trim(), phone: customerPhone.trim() }).eq("id", cid);
    }

    const res = await submitOrder({
      shopId: c.shopId,
      items: c.items.map((i) => ({
        lineId: i.lineId,
        kind: i.kind,
        itemId: i.itemId,
        qty: i.qty,
        options: i.options,
        note: i.note,
        bundleSelections: i.bundleSelections,
      })),
      fulfillment,
      payment,
      address: fulfillment === "delivery" ? address.trim() : null,
      note: note.trim() || null,
    });

    setSubmitting(false);
    if (!res.ok) return setError(res.error ?? "สั่งไม่สำเร็จ");
    cart.clear();
    setDone(true);
  }

  if (done) return (
    <div className="p-6 text-center space-y-2 max-w-md mx-auto">
      <p className="text-2xl">✅</p>
      <p className="text-lg font-semibold">ส่งคำสั่งซื้อแล้ว</p>
      <p className="text-sm text-gray-500">กำลังรอร้านยืนยันออเดอร์ ติดตามสถานะได้ที่ประวัติออเดอร์</p>
      <Link to="/orders" className="text-orange-500 underline block mt-2">ดูสถานะออเดอร์</Link>
      <Link to="/" className="text-gray-400 underline block text-sm">กลับหน้าแรก</Link>
    </div>
  );

  if (c.items.length === 0) return (
    <div className="p-6 text-center text-sm text-gray-400">
      ตะกร้าว่าง
      <Link to="/" className="text-orange-500 underline block mt-2">เลือกอาหาร</Link>
    </div>
  );

  return (
    <div className="p-4 pb-28 space-y-4 max-w-md mx-auto">
      <h1 className="text-lg font-bold">ตรวจสอบคำสั่งซื้อ</h1>
      {shop?.name && <p className="text-sm text-gray-500">ร้าน {shop.name}</p>}

      <div className="space-y-3 border-b border-gray-100 pb-3">
        {c.items.map((i) => (
          <div key={i.lineId} className="text-sm space-y-1">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{i.name} × {i.qty}</span>
              <span className="text-gray-600 shrink-0">฿{cartLineTotal(i)}</span>
            </div>
            {i.options.length > 0 && <p className="text-xs text-gray-500">{i.options.map((o) => `${o.groupName}: ${o.optionName}`).join(" · ")}</p>}
            {i.bundleSelections.length > 0 && (
              <div className="text-xs text-gray-500 pl-2 border-l border-gray-200 space-y-0.5">
                {i.bundleSelections.map((s, idx) => <p key={`${s.groupId}-${s.itemId}-${idx}`}>{s.itemName} × {s.qty}</p>)}
              </div>
            )}
            {i.note && <p className="text-xs text-gray-400">📝 {i.note}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">ข้อมูลติดต่อ</p>
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ชื่อผู้สั่ง" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="เบอร์โทร" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" type="tel" maxLength={10} />
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">รับสินค้า</p>
        <div className="flex gap-2">
          {shop?.delivery_enabled !== false && <button onClick={() => setFulfillment("delivery")} className={`flex-1 rounded-lg py-2 text-sm ${fulfillment === "delivery" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>ส่งถึงบ้าน</button>}
          {shop?.pickup_enabled !== false && <button onClick={() => setFulfillment("pickup")} className={`flex-1 rounded-lg py-2 text-sm ${fulfillment === "pickup" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>รับเอง</button>}
        </div>
        {fulfillment === "delivery" && <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ที่อยู่จัดส่ง (บ้านเลขที่ / ซอย)" value={address} onChange={(e) => setAddress(e.target.value)} />}
        {shop?.accepts_preorders && <p className="text-xs text-gray-400">ร้านนี้รองรับสั่งล่วงหน้า — ระบบเวลาเดิมจะถูกเชื่อมเข้าขั้นตอนนี้โดยไม่รื้อ logic เดิม</p>}
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">ชำระเงินตรงกับร้าน</p>
        <div className="flex gap-2">
          {shop?.payment_cash_enabled !== false && <button onClick={() => setPayment("cash")} className={`flex-1 rounded-lg py-2 text-sm ${payment === "cash" ? "bg-orange-500 text-white" : "bg-gray-100"}`}>💵 เงินสด</button>}
          {shop?.payment_qr_enabled && <button onClick={() => setPayment("qr_transfer")} className={`flex-1 rounded-lg py-2 text-sm ${payment === "qr_transfer" ? "bg-purple-600 text-white" : "bg-gray-100"}`}>📱 QR</button>}
        </div>
        {payment === "qr_transfer" && shop?.qr_code_url && <img src={shop.qr_code_url} alt="QR Code ร้าน" className="w-44 h-44 object-contain mx-auto rounded-lg border border-gray-100" />}
        <p className="text-[11px] text-gray-400">MyTree ไม่ถือเงิน ลูกค้าชำระเงินให้ร้านโดยตรง</p>
      </div>

      <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="หมายเหตุถึงร้าน (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="fixed left-4 right-4 bottom-4">
        <button onClick={confirm} disabled={submitting} className="w-full rounded-xl bg-orange-500 text-white px-4 py-3 flex justify-between text-sm font-medium disabled:opacity-50">
          <span>{submitting ? "กำลังส่ง..." : "ยืนยันคำสั่งซื้อ"}</span>
          <span>฿{cartTotal(c)}</span>
        </button>
      </div>
    </div>
  );
}
