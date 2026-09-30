import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  getOrder,
  listOrders,
  type OrderAdminCapabilities,
  type OrderDetail,
  type OrderListItem,
} from "@/lib/orderAdmin";

const PAGE_SIZE = 25;

const ORDER_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  void: "Void",
};

const DELIVERY_LABELS: Record<string, string> = {
  not_needed: "Not needed",
  needs_rider: "Needs Rider",
  rider_called: "Rider assigned",
  picked_up: "Picked up",
  delivered: "Delivered",
  failed: "Failed",
};

const WARNING_LABELS: Record<string, string> = {
  delivery_assignment_missing: "สถานะส่งมีงาน แต่ไม่มี Rider assignment",
  delivery_assignment_state_mismatch: "มี Rider assignment แต่ delivery state ไม่สอดคล้อง",
  rider_called_timestamp_missing: "Rider assigned แต่ไม่มีเวลา rider_called",
  picked_up_timestamp_missing: "Picked up แต่ไม่มีเวลา pickup",
  delivered_timestamp_missing: "Delivered แต่ไม่มีเวลา delivered",
  delivered_state_mismatch: "มี delivered timestamp แต่ state ไม่ใช่ delivered",
  paid_timestamp_missing: "Paid แต่ไม่มี paid timestamp",
  refunded_timestamp_missing: "Refunded แต่ไม่มี refunded timestamp",
  completed_timestamp_missing: "Completed แต่ไม่มี completed timestamp",
  cancelled_timestamp_missing: "Cancelled แต่ไม่มี cancelled timestamp",
  pickup_delivery_state_mismatch: "Pickup order มี delivery state ผิดปกติ",
  delivery_destination_missing: "Delivery order ไม่มีพิกัดปลายทางครบ",
  cancelled_but_paid: "Order cancelled แต่ payment ยังเป็น paid",
  delivered_order_not_closed: "ส่งถึงแล้วแต่ order ยังไม่ completed/cancelled",
};

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function money(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(number)
    : String(value);
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8).toUpperCase() : "—";
}

function statusTone(value: string) {
  if (["completed", "paid", "delivered"].includes(value)) return "bg-emerald-100 text-emerald-700";
  if (["cancelled", "refunded", "void", "failed"].includes(value)) return "bg-red-100 text-red-700";
  if (["pending", "unpaid", "needs_rider"].includes(value)) return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={"inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold " + statusTone(value)}>
      {label ?? value}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm text-gray-700">{children}</div>
    </div>
  );
}

function Section({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        {note && <p className="mt-1 text-xs leading-5 text-gray-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function OrderManagement() {
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [capabilities, setCapabilities] = useState<OrderAdminCapabilities | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [shopId, setShopId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [riderId, setRiderId] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [sort, setSort] = useState("created_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listOrders({
        search,
        dateFrom,
        dateTo,
        shopId,
        customerId,
        orderStatus,
        paymentStatus,
        paymentMethod,
        fulfillmentType,
        deliveryStatus,
        riderId,
        abnormalOnly,
        sort,
        page,
        pageSize: PAGE_SIZE,
      });
      if (requestId !== listRequestRef.current) return;
      setItems(result.items);
      setTotal(result.total);
      setCapabilities(result.capabilities);
    } catch (cause) {
      if (requestId !== listRequestRef.current) return;
      setError(cause instanceof Error ? cause.message : "โหลด Orders ไม่สำเร็จ");
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [
    search,
    dateFrom,
    dateTo,
    shopId,
    customerId,
    orderStatus,
    paymentStatus,
    paymentMethod,
    fulfillmentType,
    deliveryStatus,
    riderId,
    abnormalOnly,
    sort,
    page,
  ]);

  const loadDetail = useCallback(async (subId: string) => {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const nextDetail = await getOrder(subId);
      if (requestId !== detailRequestRef.current) return;
      setDetail(nextDetail);
    } catch (cause) {
      if (requestId !== detailRequestRef.current) return;
      setDetailError(cause instanceof Error ? cause.message : "โหลด Order detail ไม่สำเร็จ");
      setDetail(null);
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    // Invalidate any already-running request as soon as the query changes,
    // including during the debounce window before the next request starts.
    listRequestRef.current += 1;
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (selected) {
      void loadDetail(selected);
      return;
    }

    detailRequestRef.current += 1;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  }, [selected, loadDetail]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterClass = "rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-gray-400";

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Orders & Commerce Control Center</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Platform Orders</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600">
              1 แถว = 1 sub-order / 1 ร้าน เพื่อไม่ double-count multi-shop cart · “ยอดสินค้า” คือ
              server-priced item amount ของร้าน ไม่ใช่ GMV, settlement หรือเงินค่าจัดส่งที่ MyTree ถือครอง
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
            <p className="font-semibold text-gray-800">Read-first M1</p>
            <p>Admin intervention ยังปิดไว้จนกว่าจะมี approved canonical mutation contract</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className={filterClass}
            value={search}
            onChange={(event) => { setSearch(event.target.value); resetPage(); }}
            placeholder="Order / Sub-order / ลูกค้า / ร้าน / Rider"
          />
          <input
            className={filterClass}
            type="date"
            value={dateFrom}
            onChange={(event) => { setDateFrom(event.target.value); resetPage(); }}
            aria-label="วันที่เริ่ม"
          />
          <input
            className={filterClass}
            type="date"
            value={dateTo}
            onChange={(event) => { setDateTo(event.target.value); resetPage(); }}
            aria-label="วันที่สิ้นสุด"
          />
          <input
            className={filterClass}
            value={shopId}
            onChange={(event) => { setShopId(event.target.value); resetPage(); }}
            placeholder="Shop ID"
          />
          <select className={filterClass} value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); resetPage(); }}>
            <option value="">Order status ทั้งหมด</option>
            {Object.entries(ORDER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className={filterClass} value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); resetPage(); }}>
            <option value="">Payment status ทั้งหมด</option>
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className={filterClass} value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); resetPage(); }}>
            <option value="">Payment method ทั้งหมด</option>
            <option value="cash">Cash / COD</option>
            <option value="qr_transfer">QR transfer</option>
          </select>
          <select className={filterClass} value={fulfillmentType} onChange={(event) => { setFulfillmentType(event.target.value); resetPage(); }}>
            <option value="">Fulfillment ทั้งหมด</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
          <select className={filterClass} value={deliveryStatus} onChange={(event) => { setDeliveryStatus(event.target.value); resetPage(); }}>
            <option value="">Delivery status ทั้งหมด</option>
            {Object.entries(DELIVERY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input
            className={filterClass}
            value={customerId}
            onChange={(event) => { setCustomerId(event.target.value); resetPage(); }}
            placeholder="Customer UUID"
          />
          <input
            className={filterClass}
            value={riderId}
            onChange={(event) => { setRiderId(event.target.value); resetPage(); }}
            placeholder="Rider UUID"
          />
          <select className={filterClass} value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }}>
            <option value="created_desc">ล่าสุดก่อน</option>
            <option value="created_asc">เก่าสุดก่อน</option>
            <option value="activity_desc">Activity ล่าสุด</option>
            <option value="amount_desc">ยอดสินค้าสูง → ต่ำ</option>
            <option value="amount_asc">ยอดสินค้าต่ำ → สูง</option>
          </select>
        </div>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={abnormalOnly}
            onChange={(event) => { setAbnormalOnly(event.target.checked); resetPage(); }}
          />
          แสดงเฉพาะ operational warnings
        </label>

        {capabilities && (
          <p className="mt-3 text-xs text-gray-400">
            Permission view: Customer PII {capabilities.members_read ? "✓" : "restricted"} · Rider details {capabilities.riders_read ? "✓" : "restricted"} · Finance detail {capabilities.finance_read ? "✓" : "restricted"} · Time-based stuck thresholds: not configured
          </p>
        )}
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">ลองใหม่</button>
        </div>
      )}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(430px,.75fr)]">
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <State text="กำลังโหลด Orders..." />
          ) : items.length === 0 ? (
            <State text="ไม่พบ Order ตามเงื่อนไข" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3">Sub-order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Shop</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Fulfillment</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Delivery</th>
                    <th className="px-4 py-3">Rider</th>
                    <th className="px-4 py-3 text-right">ยอดสินค้า</th>
                    <th className="px-4 py-3">Warning</th>
                    <th className="px-4 py-3">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((order) => (
                    <tr
                      key={order.sub_id}
                      onClick={() => setSelected(order.sub_id)}
                      className={"cursor-pointer hover:bg-gray-50 " + (selected === order.sub_id ? "bg-emerald-50/70" : "")}
                    >
                      <td className="sticky left-0 z-[5] bg-inherit px-4 py-3">
                        <p className="font-semibold text-gray-900">{shortId(order.sub_id)}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">Hub {shortId(order.order_id)}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">{fmt(order.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.customer_name || shortId(order.customer_id)}</p>
                        {order.customer_phone && <p className="text-xs text-gray-400">{order.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.shop_name}</p>
                        <p className="text-[11px] text-gray-400">{order.shop_id}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{order.source}</td>
                      <td className="px-4 py-3"><Badge value={order.fulfillment_type} label={order.fulfillment_type} /></td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <Badge value={order.payment_status} label={PAYMENT_LABELS[order.payment_status] ?? order.payment_status} />
                          <p className="text-[11px] text-gray-400">{order.payment_method}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge value={order.order_status} label={ORDER_LABELS[order.order_status] ?? order.order_status} /></td>
                      <td className="px-4 py-3"><Badge value={order.delivery_status} label={DELIVERY_LABELS[order.delivery_status] ?? order.delivery_status} /></td>
                      <td className="px-4 py-3">
                        <p>{order.rider_name || shortId(order.assigned_rider_id)}</p>
                        {order.rider_phone && <p className="text-xs text-gray-400">{order.rider_phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(order.item_amount)}</td>
                      <td className="px-4 py-3">
                        {order.warning_count > 0 ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            {order.warning_count} warning
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{fmt(order.last_activity_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{total.toLocaleString("th-TH")} sub-orders</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
                ก่อนหน้า
              </button>
              <span>{page}/{pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
                ถัดไป
              </button>
            </div>
          </div>
        </section>

        <aside className="2xl:sticky 2xl:top-20 2xl:self-start">
          {!selected ? (
            <section className="rounded-3xl border border-gray-200 bg-white shadow-sm"><State text="เลือก sub-order เพื่อดูรายละเอียด" /></section>
          ) : detailLoading ? (
            <section className="rounded-3xl border border-gray-200 bg-white shadow-sm"><State text="กำลังโหลดรายละเอียด..." /></section>
          ) : detailError ? (
            <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-red-700">โหลด Order detail ไม่สำเร็จ</p>
              <p className="mt-2 break-words text-xs text-red-600">{detailError}</p>
              <button
                type="button"
                onClick={() => void loadDetail(selected)}
                className="mt-4 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                ลองใหม่
              </button>
            </section>
          ) : detail ? (
            <OrderDetailPanel detail={detail} />
          ) : (
            <section className="rounded-3xl border border-gray-200 bg-white shadow-sm"><State text="ไม่พบ Order detail" /></section>
          )}
        </aside>
      </div>
    </div>
  );
}

function OrderDetailPanel({ detail }: { detail: OrderDetail }) {
  const { identity, customer, shop, payment, fulfillment, delivery, order_state: orderState } = detail;
  return (
    <div className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <section className="rounded-2xl bg-gray-900 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Sub-order</p>
            <h3 className="mt-1 text-xl font-bold">{shortId(identity.sub_id)}</h3>
            <p className="mt-1 break-all text-[11px] text-gray-400">{identity.sub_id}</p>
          </div>
          <Badge value={orderState.status} label={ORDER_LABELS[orderState.status] ?? orderState.status} />
        </div>
        <p className="mt-3 text-xs text-gray-300">Hub {identity.order_id}</p>
        <p className="mt-1 text-xs text-gray-400">{fmt(identity.created_at)} · {identity.source}</p>
      </section>

      {detail.warnings.length > 0 && (
        <Section title="Operational warnings" note="กฎ deterministic เท่านั้น ไม่มี AI scoring หรือ fraud label">
          <div className="space-y-2">
            {detail.warnings.map((warning) => (
              <div key={warning} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-medium">{WARNING_LABELS[warning] ?? warning}</p>
                <p className="mt-0.5 text-[11px] text-amber-700">{warning}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Customer">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer ID"><span className="break-all">{customer.customer_id ?? "—"}</span></Field>
          <Field label="Name">{customer.details_visible ? customer.name ?? "—" : "Restricted by members.read"}</Field>
          <Field label="Phone">{customer.details_visible ? customer.phone ?? "—" : "Restricted"}</Field>
          <Field label="Drilldown">
            <Link to="/head-office/$section" params={{ section: "members" }} className="font-medium text-emerald-700 underline">Member Management</Link>
          </Field>
        </div>
      </Section>

      <Section title="Shop">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Shop">{shop.name}</Field>
          <Field label="Shop ID">{shop.shop_id}</Field>
          <Field label="Phone">{shop.phone ?? "—"}</Field>
          <Field label="Drilldown">
            <Link to="/head-office/$section" params={{ section: "shops" }} className="font-medium text-emerald-700 underline">Shop Management</Link>
          </Field>
        </div>
      </Section>

      <Section title="Items" note="ใช้ stored order snapshot; ไม่ re-price จากเมนูปัจจุบัน">
        <div className="space-y-2">
          {detail.items.length === 0 ? <p className="text-sm text-gray-400">ไม่มี item snapshot</p> : detail.items.map((item) => (
            <div key={item.id} className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">qty {item.qty} × {money(item.unit_price)}</p>
                  {item.item_note && <p className="mt-1 text-xs text-gray-500">Note: {item.item_note}</p>}
                </div>
                <p className="font-semibold tabular-nums">{item.line_total == null ? "stored total unavailable" : money(item.line_total)}</p>
              </div>
            </div>
          ))}
          <div className="flex justify-between border-t border-gray-200 pt-3 font-semibold">
            <span>ยอดสินค้า sub-order</span>
            <span>{money(detail.amounts.item_amount)}</span>
          </div>
          <p className="text-xs text-gray-400">Hub item total: {money(detail.amounts.hub_item_total)} · delivery charge แยกต่างหาก</p>
        </div>
      </Section>

      <Section title="Payment" note="ไม่มี canonical field แยกสำหรับ shop-confirmation actor และไม่มี settlement state จึงไม่อนุมาน">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Method">{payment.method}</Field>
          <Field label="Status"><Badge value={payment.status} label={PAYMENT_LABELS[payment.status] ?? payment.status} /></Field>
          <Field label="Payment pending">{fmt(payment.payment_pending_at)}</Field>
          <Field label="Paid">{fmt(payment.paid_at)}</Field>
          <Field label="Refunded">{fmt(payment.refunded_at)}</Field>
          <Field label="Slip">{payment.slip_present ? (payment.slip_url ? <a href={payment.slip_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">เปิดสลิป</a> : "มีสลิป · URL restricted") : "ไม่มีสลิป"}</Field>
        </div>
        {detail.amounts.finance_visible ? (
          <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2">
            <Field label="Delivery fee snapshot">{money(detail.amounts.delivery_fee)}</Field>
            <Field label="Calculated delivery fee">{money(detail.amounts.calculated_delivery_fee)}</Field>
            <Field label="Customer delivery charge">{money(detail.amounts.customer_delivery_charge)}</Field>
            <Field label="Fee payer">{detail.amounts.delivery_fee_payer ?? "—"}</Field>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400">รายละเอียด finance-sensitive ถูกซ่อนตาม finance.read</p>
        )}
      </Section>

      <Section title="Fulfillment & Delivery">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fulfillment">{fulfillment.type}</Field>
          <Field label="Delivery status"><Badge value={delivery.status} label={DELIVERY_LABELS[delivery.status] ?? delivery.status} /></Field>
          <Field label="Address">{fulfillment.delivery_address ?? (detail.capabilities.members_read ? "—" : "Restricted by members.read")}</Field>
          <Field label="Customer note">{fulfillment.customer_note ?? (detail.capabilities.members_read ? "—" : "Restricted")}</Field>
          <Field label="Rider ID"><span className="break-all">{delivery.assigned_rider_id ?? "—"}</span></Field>
          <Field label="Rider">{delivery.rider_details_visible ? delivery.rider_name ?? "—" : "Restricted by riders.read"}</Field>
          <Field label="Assigned">{fmt(delivery.rider_called_at)}</Field>
          <Field label="Picked up">{fmt(delivery.picked_up_at)}</Field>
          <Field label="Delivered">{fmt(delivery.delivered_at)}</Field>
          <Field label="Failed">{fmt(delivery.failed_at)}</Field>
        </div>
        {delivery.assigned_rider_id && (
          <Link to="/head-office/$section" params={{ section: "riders" }} className="mt-3 inline-flex text-sm font-medium text-emerald-700 underline">
            เปิด Rider Management
          </Link>
        )}
        {delivery.proof_present && (
          <p className="mt-3 text-xs text-gray-500">
            Delivery proof: {delivery.proof_url ? <a href={delivery.proof_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">เปิดหลักฐาน</a> : delivery.proof_path ? "มี proof path" : "มีหลักฐาน · restricted"}
          </p>
        )}
      </Section>

      <Section title="Canonical timeline" note="แสดงเฉพาะ timestamp/event ที่มี evidence จริง ไม่มี event ที่เดาจาก UI state">
        <div className="space-y-3">
          {detail.timeline.length === 0 ? <p className="text-sm text-gray-400">ไม่มี timeline evidence</p> : detail.timeline.map((event, index) => (
            <div key={event.event_type + event.occurred_at + index} className="border-l-2 border-gray-200 pl-3">
              <p className="text-sm font-medium text-gray-800">{event.event_type}</p>
              <p className="text-xs text-gray-500">{fmt(event.occurred_at)} · {event.source}</p>
              {event.note && <p className="mt-1 text-xs text-gray-500">{event.note}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Admin audit">
        {detail.capabilities.audit_read ? (
          detail.audit.length ? (
            <div className="space-y-3">
              {detail.audit.map((entry) => (
                <div key={entry.audit_id} className="border-l-2 border-gray-200 pl-3">
                  <p className="text-sm font-medium">{entry.action}</p>
                  <p className="text-xs text-gray-500">{fmt(entry.created_at)} · {entry.actor_role_key ?? "unknown role"}</p>
                  {entry.reason && <p className="mt-1 text-xs text-gray-500">{entry.reason}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">ยังไม่มี Head Office privileged action สำหรับ order นี้</p>
        ) : <p className="text-sm text-gray-400">Audit history ถูกจำกัดด้วย system.audit.read</p>}
      </Section>

      <Section title="Admin intervention">
        <div className="rounded-xl bg-gray-100 p-3 text-sm text-gray-600">
          <p className="font-semibold text-gray-800">Unavailable in M1</p>
          <p className="mt-1 leading-5">{detail.intervention.reason}</p>
          <p className="mt-2 text-xs">UI นี้ไม่ direct UPDATE status fields และไม่ bypass trigger/RLS</p>
        </div>
      </Section>
    </div>
  );
}

function State({ text }: { text: string }) {
  return <div className="p-10 text-center text-sm text-gray-500">{text}</div>;
}
