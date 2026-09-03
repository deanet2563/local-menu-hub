import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { linkRichMenu } from "@/lib/richmenu";

type Shop = {
  shop_id: string;
  name: string;
  logo_url: string | null;
  is_open: boolean;
  is_approved: boolean;
  is_banned: boolean;
};

type Order = {
  sub_id: string;
  amount: number;
  created_at: string;
  order_status: string;
  payment_status: string;
  delivery_status: string;
  fulfillment_type: "pickup" | "delivery";
  requested_for: string | null;
};

type LoadState = "loading" | "no-auth" | "no-shop" | "ok" | "error";

const THAI_ORDER_STATUS: Record<string, string> = {
  pending: "ออเดอร์ใหม่",
  confirmed: "รับออเดอร์แล้ว",
  preparing: "กำลังทำ",
  completed: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

function isToday(value: string) {
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function money(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value || 0);
}

function shortId(value: string) {
  return value.slice(0, 6).toUpperCase();
}

export function ShopDashboard() {
  const [state, setState] = useState<LoadState>("loading");
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      await initLiff();
      const customerId = await getCurrentCustomerId();
      if (!customerId) return setState("no-auth");

      const { data: staff, error: staffError } = await supabase
        .from("shop_staff")
        .select("shop_id")
        .eq("customer_id", customerId)
        .limit(1)
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staff) return setState("no-shop");

      const shopId = (staff as { shop_id: string }).shop_id;
      const [{ data: shopRow, error: shopError }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase.from("shops").select("shop_id,name,logo_url,is_open,is_approved,is_banned").eq("shop_id", shopId).single(),
        supabase
          .from("sub_orders")
          .select("sub_id,amount,created_at,order_status,payment_status,delivery_status,fulfillment_type,requested_for")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      if (shopError) throw shopError;
      if (orderError) throw orderError;

      setShop(shopRow as Shop);
      setOrders((orderRows as Order[]) ?? []);
      setState("ok");
      void linkRichMenu("shop");
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลร้านไม่สำเร็จ");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const todayOrders = useMemo(() => orders.filter((o) => isToday(o.created_at)), [orders]);
  const todaySales = useMemo(
    () => todayOrders.filter((o) => o.order_status !== "cancelled").reduce((sum, o) => sum + Number(o.amount || 0), 0),
    [todayOrders],
  );
  const waitingToMake = useMemo(
    () => orders.filter((o) => ["pending", "confirmed", "preparing"].includes(o.order_status)).length,
    [orders],
  );
  const waitingRider = useMemo(
    () => orders.filter((o) => o.fulfillment_type === "delivery" && ["rider_called", "needs_rider"].includes(o.delivery_status)).length,
    [orders],
  );
  const advanceOrders = useMemo(() => orders.filter((o) => o.requested_for && new Date(o.requested_for).getTime() > Date.now()), [orders]);
  const latest = orders.slice(0, 4);

  if (state === "loading") return <div className="min-h-screen bg-slate-50 p-6 text-sm text-slate-400">กำลังเปิด MyTree Shop...</div>;
  if (state === "no-auth") return <div className="min-h-screen bg-slate-50 p-8 text-center">🔒 กรุณาเปิดผ่าน LINE เพื่อเข้าสู่ระบบร้านค้า</div>;
  if (state === "no-shop") return <div className="min-h-screen bg-slate-50 p-8 text-center"><a className="font-semibold text-emerald-600 underline" href="/sweet/signup">สมัครร้านค้ากับ MyTree</a></div>;
  if (state === "error") return <div className="min-h-screen bg-slate-50 p-8 text-center"><p className="text-red-600">{error}</p><button onClick={() => void load()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-white">ลองใหม่</button></div>;
  if (!shop) return null;

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="h-11 w-11 overflow-hidden rounded-2xl bg-slate-100">
            {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xl">🌳</div>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{shop.name}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 font-medium ${shop.is_open ? "text-emerald-600" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${shop.is_open ? "bg-emerald-500" : "bg-slate-300"}`} />{shop.is_open ? "เปิดร้าน" : "ปิดร้าน"}</span>
              {!shop.is_approved && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">รออนุมัติ</span>}
              {shop.is_banned && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">ระงับร้าน</span>}
            </div>
          </div>
          <a href="/sweet/shop" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white" aria-label="ตั้งค่าร้าน">⚙️</a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">MyTree Shop</p><h1 className="mt-1 text-2xl font-black">สวัสดี ร้านค้า 👋</h1></div>
            <a href="/sweet/orders" className="text-sm font-semibold text-emerald-600">ดูออเดอร์ทั้งหมด</a>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a href="/sweet/orders" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <p className="text-xs text-slate-500">ออเดอร์วันนี้</p><p className="mt-2 text-3xl font-black">{todayOrders.length}</p><p className="mt-1 text-xs text-slate-400">รายการ</p>
            </a>
            <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
              <p className="text-xs text-slate-300">ยอดขายวันนี้</p><p className="mt-2 text-3xl font-black">฿{money(todaySales)}</p><p className="mt-1 text-xs text-slate-400">ไม่รวมออเดอร์ยกเลิก</p>
            </div>
            <a href="/sweet/orders" className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <p className="text-xs font-medium text-amber-700">รอทำ</p><p className="mt-2 text-3xl font-black text-amber-900">{waitingToMake}</p><p className="mt-1 text-xs text-amber-700/70">ต้องดำเนินการ</p>
            </a>
            <a href="/sweet/orders" className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
              <p className="text-xs font-medium text-sky-700">รอ Rider</p><p className="mt-2 text-3xl font-black text-sky-900">{waitingRider}</p><p className="mt-1 text-xs text-sky-700/70">กำลังเรียก / รอรับงาน</p>
            </a>
          </div>
        </section>

        {advanceOrders.length > 0 && (
          <a href="/sweet/orders" className="flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <div><p className="font-bold text-violet-900">🗓️ มีออเดอร์สั่งล่วงหน้า</p><p className="mt-1 text-sm text-violet-700">{advanceOrders.length} รายการที่ต้องเตรียมตามวันและเวลาที่ลูกค้าเลือก</p></div><span className="text-xl text-violet-400">›</span>
          </a>
        )}

        <section>
          <h2 className="mb-3 text-base font-bold">จัดการร้าน</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              ["/sweet/orders", "📦", "ออเดอร์"],
              ["/sweet/menu", "🍜", "เมนู"],
              ["/sweet/shop", "🏪", "ตั้งค่าร้าน"],
              ["/sweet/riders", "🛵", "การส่ง"],
            ].map(([href, icon, label]) => (
              <a key={href} href={href} className="rounded-2xl bg-white px-2 py-3 text-center shadow-sm ring-1 ring-slate-100">
                <div className="text-2xl">{icon}</div><div className="mt-1 text-xs font-semibold">{label}</div>
              </a>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">ออเดอร์ล่าสุด</h2><button onClick={() => void load()} className="text-xs font-semibold text-slate-500">รีเฟรช</button></div>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            {latest.length === 0 ? <div className="p-6 text-center text-sm text-slate-400">ยังไม่มีออเดอร์</div> : latest.map((order, index) => (
              <a href="/sweet/orders" key={order.sub_id} className={`flex items-center gap-3 p-4 ${index ? "border-t border-slate-100" : ""}`}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-black">#{shortId(order.sub_id)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{order.fulfillment_type === "pickup" ? "ลูกค้ามารับที่ร้าน" : "จัดส่ง"}{order.requested_for ? " · สั่งล่วงหน้า" : ""}</p><p className="mt-1 text-xs text-slate-500">{THAI_ORDER_STATUS[order.order_status] ?? order.order_status} · {order.payment_status === "paid" ? "ชำระแล้ว" : "รอชำระ/ตรวจยอด"}</p></div>
                <div className="text-right"><p className="text-sm font-black">฿{money(Number(order.amount))}</p><span className="text-slate-300">›</span></div>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50">🔔</div><div className="flex-1"><p className="font-bold">Notification Center</p><p className="mt-1 text-sm leading-6 text-slate-500">ออเดอร์ใหม่, สลิป, Rider, แชท, รีวิว และข้อความจาก MyTree Admin จะถูกรวมไว้ที่นี่ในขั้นถัดไป</p></div></div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-4 px-2 py-2">
          <a href="/sweet/" className="rounded-xl py-2 text-center text-emerald-600"><div>⌂</div><div className="text-[11px] font-bold">หน้าหลัก</div></a>
          <a href="/sweet/orders" className="rounded-xl py-2 text-center text-slate-500"><div>▣</div><div className="text-[11px] font-medium">ออเดอร์</div></a>
          <a href="/sweet/menu" className="rounded-xl py-2 text-center text-slate-500"><div>☰</div><div className="text-[11px] font-medium">เมนู</div></a>
          <a href="/sweet/shop" className="rounded-xl py-2 text-center text-slate-500"><div>●</div><div className="text-[11px] font-medium">ร้านของฉัน</div></a>
        </div>
      </nav>
    </main>
  );
}
