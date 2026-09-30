import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ShopVerificationReview } from "@/components/head-office/ShopVerificationReview";
import {
  getAdminAccessContext,
  hasAdminPermission,
  type AdminAccessContext,
} from "@/lib/adminAccess";
import {
  getShop,
  listShops,
  sendShopProfileReminder,
  shopLifecycle,
  SHOP_READINESS_LABELS,
  type ShopDetail,
  type ShopLifecycleAction,
  type ShopListItem,
} from "@/lib/shopAdmin";

const fmt = (value: unknown) =>
  typeof value === "string" && value
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

export function ShopManagement() {
  const [access, setAccess] = useState<AdminAccessContext | null>(null);
  const [items, setItems] = useState<ShopListItem[]>([]);
  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [approval, setApproval] = useState("");
  const [activity, setActivity] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("status_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const detailRequestRef = useRef(0);
  const selectedRef = useRef<string | null>(selected);
  selectedRef.current = selected;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState("ข้อมูลครบถ้วน");
  const [approvalOtherReason, setApprovalOtherReason] = useState("");

  const canAction = !!access && hasAdminPermission(access, "shops.action");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listShops({
        search,
        approval,
        activity,
        category,
        sort,
        page,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดร้านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [search, approval, activity, category, sort, page]);

  const loadDetail = useCallback(async (id: string) => {
    if (selectedRef.current !== id) return;
    const requestId = ++detailRequestRef.current;
    setDetail(null);
    setDetailLoading(true);
    setError(null);
    try {
      const nextDetail = await getShop(id);
      if (requestId !== detailRequestRef.current || selectedRef.current !== id) return;
      setDetail(nextDetail);
    } catch (e) {
      if (requestId !== detailRequestRef.current || selectedRef.current !== id) return;
      setDetail(null);
      setError(e instanceof Error ? e.message : "โหลดรายละเอียดร้านไม่สำเร็จ");
    } finally {
      if (requestId === detailRequestRef.current && selectedRef.current === id) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void getAdminAccessContext().then(setAccess);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (selected) {
      void loadDetail(selected);
    } else {
      detailRequestRef.current += 1;
      setDetail(null);
      setDetailLoading(false);
    }
  }, [selected, loadDetail]);

  const pages = Math.max(1, Math.ceil(total / 20));

  async function act(
    action: ShopLifecycleAction,
    label: string,
    danger = false,
  ) {
    if (!selected) return;
    const reason = window.prompt(`เหตุผลในการ${label} (บันทึก Audit)`);
    if (!reason) return;
    if (
      danger &&
      !window.confirm(`${label} มีผลต่อการให้บริการของร้าน ยืนยันหรือไม่?`)
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await shopLifecycle(selected, action, reason);
      if (action === "approve") setNotice("อนุมัติร้านเรียบร้อยแล้ว");
      await Promise.all([load(), loadDetail(selected)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function requestApprove() {
    setApprovalReason("ข้อมูลครบถ้วน");
    setApprovalOtherReason("");
    setApprovalDialogOpen(true);
  }

  async function confirmApprove() {
    if (!selected) return;
    const reason = approvalReason === "เหตุผลอื่นๆ"
      ? approvalOtherReason.trim()
      : approvalReason;
    if (!reason) {
      setError("กรุณาระบุเหตุผลในการอนุมัติ");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await shopLifecycle(selected, "approve", reason);
      setNotice("อนุมัติร้านเรียบร้อยแล้ว");
      setApprovalDialogOpen(false);
      await Promise.all([load(), loadDetail(selected)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อนุมัติร้านไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remindShop() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    setReminderFeedback("กำลังส่ง LINE แจ้งร้าน...");
    try {
      const result = await sendShopProfileReminder(selected);
      const message = result.ok
        ? "ส่ง LINE แจ้งร้านให้กรอกข้อมูลเรียบร้อยแล้ว"
        : "สร้างรายการแจ้งเตือนแล้ว";
      setNotice(message);
      setReminderFeedback(message);
      await loadDetail(selected);
    } catch (e) {
      const message = e instanceof Error ? e.message : "ส่งแจ้งเตือนไม่สำเร็จ";
      setError(message);
      setReminderFeedback(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-emerald-700">
          Shops & Business Management
        </p>
        <h2 className="mt-1 text-2xl font-bold">ร้านค้า MyTree</h2>
        <p className="mt-1 text-sm text-gray-500">
          ร้านจะอยู่ Pending จนกว่าข้อมูลบังคับครบ และ Admin ไม่สามารถอนุมัติร้านที่ยังไม่ผ่าน Readiness Gate
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ชื่อร้าน / Shop ID / เบอร์"
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
          <select
            value={approval}
            onChange={(e) => {
              setApproval(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">ทุกสถานะ</option>
            <option value="ready">Ready</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="banned">Banned</option>
          </select>
          <select
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">เปิด/ปิดทั้งหมด</option>
            <option value="open">เปิดร้าน</option>
            <option value="closed">ปิดร้าน</option>
          </select>
          <input
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            placeholder="หมวดร้าน"
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="status_desc">Latest / อัปเดตล่าสุด</option>
            <option value="created_desc">สร้างล่าสุด</option>
            <option value="created_asc">สร้างเก่าสุด</option>
            <option value="name_asc">ชื่อ A–Z</option>
            <option value="name_desc">ชื่อ Z–A</option>
          </select>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
          <button
            onClick={() => void load()}
            className="ml-3 font-semibold underline"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(390px,.65fr)]">
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          {loading ? (
            <State text="กำลังโหลดร้าน..." />
          ) : items.length === 0 ? (
            <State text="ไม่พบร้านตามเงื่อนไข" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="sticky left-0 bg-gray-50 px-4 py-3">ร้าน</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">Readiness</th>
                    <th className="px-4 py-3">หมวด</th>
                    <th className="px-4 py-3">เมนู</th>
                    <th className="px-4 py-3">Map</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr
                      key={item.shop_id}
                      onClick={() => setSelected(item.shop_id)}
                      className={
                        "cursor-pointer hover:bg-gray-50 " +
                        (selected === item.shop_id ? "bg-emerald-50" : "")
                      }
                    >
                      <td className="sticky left-0 bg-inherit px-4 py-4">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.phone || "ไม่มีเบอร์"}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {item.shop_id}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge item={item} />
                        <p className="mt-1 whitespace-nowrap text-[10px] text-gray-400">
                          {fmt(item.status_updated_at)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <ReadinessBadge item={item} />
                      </td>
                      <td className="px-4 py-4">{item.category || "—"}</td>
                      <td className="px-4 py-4 tabular-nums">
                        {item.menu_item_count}
                      </td>
                      <td className="px-4 py-4">
                        {item.has_location ? "มีพิกัด" : "ยังไม่มี"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager
            page={page}
            pages={pages}
            total={total}
            setPage={setPage}
          />
        </section>

        <aside className="rounded-3xl border bg-white p-5 shadow-sm">
          {!selected ? (
            <State text="เลือกร้านเพื่อดูรายละเอียด" />
          ) : detailLoading || !detail ? (
            <State text="กำลังโหลดรายละเอียด..." />
          ) : (
            <ShopDetailPanel
              detail={detail}
              canAction={canAction}
              saving={saving}
              act={act}
              requestApprove={requestApprove}
              remindShop={remindShop}
              reminderFeedback={reminderFeedback}
            />
          )}
        </aside>
      </div>

      {approvalDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">อนุมัติร้านค้า</h3>
            <p className="mt-1 text-sm text-gray-500">
              เลือกเหตุผลในการอนุมัติ เหตุผลนี้จะถูกบันทึกใน Audit history
            </p>

            <div className="mt-4 space-y-2">
              {[
                "ข้อมูลครบถ้วน",
                "ตรวจสอบข้อมูลร้านแล้ว",
                "ข้อมูลและสถานที่ถูกต้อง",
                "แก้ไขข้อมูลตามที่แจ้งครบแล้ว",
                "เหตุผลอื่นๆ",
              ].map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-3 rounded-xl border px-3 py-3 text-sm"
                >
                  <input
                    type="radio"
                    name="approval-reason"
                    value={reason}
                    checked={approvalReason === reason}
                    onChange={() => setApprovalReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {approvalReason === "เหตุผลอื่นๆ" && (
              <textarea
                value={approvalOtherReason}
                onChange={(e) => setApprovalOtherReason(e.target.value)}
                rows={3}
                placeholder="ระบุเหตุผล"
                className="mt-3 w-full rounded-xl border p-3 text-sm"
              />
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setApprovalDialogOpen(false)}
                className="rounded-xl border px-4 py-3 text-sm font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmApprove()}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "กำลังอนุมัติ..." : "ยืนยันอนุมัติ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopDetailPanel({
  detail,
  canAction,
  saving,
  act,
  requestApprove,
  remindShop,
  reminderFeedback,
}: {
  detail: ShopDetail;
  canAction: boolean;
  saving: boolean;
  act: (
    action: ShopLifecycleAction,
    label: string,
    danger?: boolean,
  ) => Promise<void>;
  requestApprove: () => void;
  remindShop: () => Promise<void>;
  reminderFeedback: string | null;
}) {
  const shop = detail.shop;
  const missing = detail.readiness?.missing ?? [];
  const businessHours = formatBusinessHours(shop.business_hours);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">{shop.name}</h3>
            <p className="text-xs text-gray-400">{shop.shop_id}</p>
          </div>
          <Badge item={shop as unknown as ShopListItem} />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {String(shop.description || "ยังไม่มีคำอธิบาย")}
        </p>
      </div>

      <section
        className={
          detail.readiness.ready
            ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
            : "rounded-2xl border border-amber-200 bg-amber-50 p-4"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-gray-900">Shop Readiness</h4>
            <p className="mt-1 text-sm text-gray-600">
              {detail.readiness.ready
                ? "ข้อมูลบังคับครบ ร้านผ่าน Readiness Gate"
                : detail.readiness.legacy_grace && shop.is_approved
                  ? `Legacy approved — ยังขาด ${detail.readiness.missing_count} รายการ แต่ร้านเดิมยังคง Approved ตาม production grace; ต้องกรอกให้ครบก่อนการอนุมัติใหม่`
                  : `ยังขาด ${detail.readiness.missing_count} รายการ — ร้านต้องอยู่ Pending`}
            </p>
          </div>
          <span
            className={
              detail.readiness.ready
                ? "rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white"
            }
          >
            {detail.readiness.ready ? "Ready" : "Incomplete"}
          </span>
        </div>

        {!detail.readiness.ready && (
          <ul className="mt-3 space-y-1 text-sm text-amber-900">
            {missing.map((key) => (
              <li key={key}>• {SHOP_READINESS_LABELS[key] ?? key}</li>
            ))}
          </ul>
        )}

        {canAction && !detail.readiness.ready && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void remindShop()}
              className="w-full rounded-xl bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "กำลังส่ง..." : "แจ้งร้านให้กรอกข้อมูลให้ครบ"}
            </button>
            {reminderFeedback && (
              <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-amber-900">
                {reminderFeedback}
              </p>
            )}
          </div>
        )}
      </section>

      <Block title="ข้อมูลร้าน">
        <DataRow label="ชื่อร้าน" value={shop.name} />
        <DataRow label="หมวดร้าน" value={shop.category} />
        <DataRow label="Shop ID" value={shop.shop_id} mono />
        <DataRow label="สร้างเมื่อ" value={fmt(shop.created_at)} />
        <DataRow label="อนุมัติเมื่อ" value={fmt(shop.approved_at)} />
        <DataRow label="สถานะเปิดร้าน" value={shop.is_open === true ? "เปิด" : "ปิด"} />
      </Block>

      <Block title="บัญชีเจ้าของร้าน / ผู้ดูแลร้าน">
        <p className="mb-3 text-xs text-gray-500">
          Owner Account คือบัญชี MyTree ที่มีสิทธิ์จัดการร้านและรับการแจ้งเตือนสำคัญของร้าน
        </p>
        {detail.staff.length ? (
          detail.staff.map((item) => (
            <div key={item.customer_id} className="mb-3 rounded-xl border bg-white p-3">
              <DataRow label="ชื่อบัญชี" value={item.name || "ไม่ระบุชื่อ"} />
              <DataRow label="Role" value={item.role} />
              <DataRow label="เบอร์บัญชี" value={item.phone || "ไม่มีเบอร์"} />
              <DataRow label="Customer ID" value={item.customer_id} mono />
              <DataRow label="ผูกกับร้านเมื่อ" value={fmt(item.created_at)} />
            </div>
          ))
        ) : (
          <p>ยังไม่มีบัญชีเจ้าของร้าน / Staff linkage</p>
        )}
      </Block>

      <ShopVerificationReview
        shopId={shop.shop_id}
        canAction={canAction}
        onChanged={() => window.location.reload()}
      />

      <Block title="ข้อมูลติดต่อ & ที่ตั้งร้าน">
        <DataRow label="เบอร์โทรร้าน" value={shop.phone} />
        <DataRow label="อีเมล" value={shop.email} />
        <DataRow label="ที่อยู่" value={shop.address} />
        <DataRow label="หมู่บ้าน" value={shop.village} />
        <DataRow label="โซน" value={shop.zone} />
        <DataRow label="ซอย" value={shop.soi} />
        <DataRow label="Latitude" value={shop.lat} />
        <DataRow label="Longitude" value={shop.lng} />
        <DataRow label="Google Maps" value={shop.google_maps_url || shop.google_maps_link} />
        <DataRow label="อัปเดตพิกัดล่าสุด" value={fmt(shop.location_updated_at)} />
      </Block>

      <Block title="วันและเวลาทำการ">
        {businessHours.length ? (
          <div className="space-y-1">
            {businessHours.map((line) => (
              <p key={line.key} className="flex justify-between gap-4">
                <span>{line.label}</span>
                <span className="font-medium text-gray-900">{line.value}</span>
              </p>
            ))}
          </div>
        ) : (
          <p>ยังไม่มีข้อมูลเวลาทำการ</p>
        )}
      </Block>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Menu" value={detail.menu.total} />
        <Metric label="Orders" value={detail.commerce.total_orders} />
        <Metric label="Reviews" value={detail.reviews.count} />
      </div>

      <Block title="เมนูร้าน">
        {detail.menu_items?.length ? (
          <div className="space-y-2">
            {detail.menu_items.map((item) => (
              <div key={item.item_id} className="flex items-start justify-between gap-3 rounded-xl border bg-white p-3">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.category || "ไม่มีหมวดเมนู"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">฿{Number(item.price).toLocaleString("th-TH")}</p>
                  <p className={item.is_available ? "text-xs text-emerald-600" : "text-xs text-gray-400"}>
                    {item.is_available ? "พร้อมขาย" : "ปิดขาย"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>ยังไม่มีเมนู</p>
        )}
      </Block>

      <Block title="การรับออเดอร์ & Delivery">
        <DataRow label="Pickup" value={yesNo(shop.pickup_enabled)} />
        <DataRow label="Delivery" value={yesNo(shop.delivery_enabled)} />
        <DataRow label="Pre-order" value={yesNo(shop.accepts_preorders)} />
        <DataRow label="เรียก MyTree Rider" value={yesNo(shop.rider_request_enabled)} />
        <DataRow label="พื้นที่/หมายเหตุจัดส่ง" value={shop.service_area_note} />
        <DataRow label="การคิดค่าจัดส่งลูกค้า" value={shop.customer_delivery_pricing_mode} />
        <DataRow label="ค่าจัดส่งแบบ Flat" value={moneyOrDash(shop.customer_delivery_flat_fee)} />
        <DataRow label="ขั้นต่ำส่งฟรี" value={moneyOrDash(shop.customer_free_delivery_min_order)} />
      </Block>

      <Block title="การชำระเงิน">
        <DataRow label="เงินสด" value={yesNo(shop.payment_cash_enabled)} />
        <DataRow label="QR / โอน" value={yesNo(shop.payment_qr_enabled)} />
        <DataRow label="QR Code" value={shop.qr_code_url ? "มี QR Code" : "—"} />
      </Block>

      <Block title="ช่องทางออนไลน์">
        <DataRow label="Website" value={shop.website_url} />
        <DataRow label="LINE" value={shop.line_url} />
        <DataRow label="Facebook" value={shop.facebook_url} />
        <DataRow label="Instagram" value={shop.instagram_url} />
        <DataRow label="TikTok" value={shop.tiktok_url} />
      </Block>

      <Block title="Commerce summary">
        <DataRow label="Pending orders" value={detail.commerce.pending_orders} />
        <DataRow label="Paid orders" value={detail.commerce.paid_orders} />
        <DataRow label="Rating" value={detail.reviews.average_rating ?? "—"} />
        <DataRow label="จำนวนรีวิว" value={detail.reviews.count} />
      </Block>

      <Block title="Integration availability">
        <p>
          Branches: Unavailable · POS: Unavailable · Promotions: Unavailable ·
          Community linkage: Unavailable
        </p>
        <p className="mt-1 text-xs">
          ยังไม่มี canonical source ใน Shop Management M1 จึงไม่สร้างสถานะจำลอง
        </p>
      </Block>

      {canAction && (
        <div className="flex flex-wrap gap-2">
          {!shop.is_approved && (
            <>
              <button
                disabled={saving || !detail.readiness.ready}
                onClick={requestApprove}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {detail.readiness.ready ? "Approve" : "Approve ไม่ได้ — ข้อมูลไม่ครบ"}
              </button>
              {!shop.approval_rejected_at && (
                <button
                  disabled={saving}
                  onClick={() => void act("reject", "ปฏิเสธร้าน", true)}
                  className="rounded-xl border border-amber-300 px-3 py-2 text-sm text-amber-800"
                >
                  Reject
                </button>
              )}
            </>
          )}
          {!shop.is_banned ? (
            <button
              disabled={saving}
              onClick={() => void act("ban", "Ban ร้าน", true)}
              className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700"
            >
              Ban
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={() => void act("unban", "Unban ร้าน")}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              Unban
            </button>
          )}
        </div>
      )}

      {shop.approval_rejected_at && (
        <Block title="สถานะการปฏิเสธ">
          <DataRow label="ปฏิเสธเมื่อ" value={fmt(shop.approval_rejected_at)} />
          <DataRow label="เหตุผล" value={shop.approval_rejected_reason} />
        </Block>
      )}

      {shop.deletion_requested_at && canAction && (
        <Block title="คำขอลบร้าน">
          <DataRow label="ขอเมื่อ" value={fmt(shop.deletion_requested_at)} />
          <DataRow label="เหตุผล" value={shop.deletion_reason} />
          <DataRow label="สถานะ" value={shop.deletion_status} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={saving}
              onClick={() => void act("deletion_approve", "อนุมัติการลบร้าน", true)}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white"
            >
              อนุมัติลบ
            </button>
            <button
              disabled={saving}
              onClick={() => void act("deletion_reject", "ปฏิเสธการลบร้าน")}
              className="rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              ปฏิเสธ
            </button>
            <button
              disabled={saving}
              onClick={() => void act("deletion_defer", "เลื่อนการตัดสินใจลบร้าน")}
              className="rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              เลื่อนไว้ก่อน
            </button>
          </div>
        </Block>
      )}

      {detail.reminders?.length > 0 && (
        <Block title="Profile reminders">
          {detail.reminders.slice(0, 5).map((item) => (
            <div key={item.reminder_id} className="mt-2 border-l-2 pl-3">
              <p className="text-sm font-medium">
                {item.delivery_channel.toUpperCase()} · {item.delivery_status}
              </p>
              <p className="text-xs text-gray-500">
                {fmt(item.created_at)} · ขาด {item.missing_fields.length} รายการ
              </p>
            </div>
          ))}
        </Block>
      )}

      <Block title="Audit history">
        {detail.audit.length ? (
          detail.audit.map((item) => (
            <div key={item.audit_id} className="mt-2 border-l-2 pl-3">
              <p className="font-medium">{item.action}</p>
              <p className="text-xs">
                {fmt(item.created_at)} · {item.reason || "—"}
              </p>
            </div>
          ))
        ) : (
          <p>ยังไม่มี Audit history สำหรับร้านนี้</p>
        )}
      </Block>
    </div>
  );
}

function formatBusinessHours(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const hours = value as Record<string, { open?: string; close?: string; closed?: boolean }>;
  const days = [
    ["mon", "จันทร์"],
    ["tue", "อังคาร"],
    ["wed", "พุธ"],
    ["thu", "พฤหัสบดี"],
    ["fri", "ศุกร์"],
    ["sat", "เสาร์"],
    ["sun", "อาทิตย์"],
  ] as const;
  return days.map(([key, label]) => {
    const item = hours[key];
    const valueText = !item || item.closed
      ? "ปิด"
      : `${item.open || "—"}–${item.close || "—"}`;
    return { key, label, value: valueText };
  });
}

function yesNo(value: unknown) {
  return value === true ? "เปิดใช้งาน" : "ไม่เปิดใช้งาน";
}

function moneyOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? `฿${amount.toLocaleString("th-TH")}` : String(value);
}

function DataRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
}) {
  const text = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-3 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className={`break-words text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>
        {text}
      </span>
    </div>
  );
}

function Badge({ item }: { item: ShopListItem }) {
  const [text, className] = item.is_banned
    ? ["Banned", "bg-red-100 text-red-700"]
    : item.is_approved
      ? ["Approved", "bg-emerald-100 text-emerald-700"]
      : item.approval_rejected_at
        ? ["Rejected", "bg-orange-100 text-orange-800"]
        : ["Pending", "bg-amber-100 text-amber-700"];

  return (
    <span className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-xs font-semibold leading-none ${className}`}>
      {text}
    </span>
  );
}

function ReadinessBadge({ item }: { item: ShopListItem }) {
  if (item.readiness?.ready) {
    return (
      <span className="whitespace-nowrap text-xs font-medium text-emerald-700">
        Ready
      </span>
    );
  }

  if (item.readiness?.legacy_grace && item.is_approved) {
    return (
      <span className="whitespace-nowrap text-xs font-medium text-amber-700">
        Legacy Approved · ขาด {item.readiness?.missing_count ?? "—"}
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap text-xs font-medium text-amber-700">
      ขาด {item.readiness?.missing_count ?? "—"}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
      <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
      {children}
    </section>
  );
}

function State({ text }: { text: string }) {
  return <div className="p-10 text-center text-sm text-gray-500">{text}</div>;
}

function Pager({
  page,
  pages,
  total,
  setPage,
}: {
  page: number;
  pages: number;
  total: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t p-3 text-sm text-gray-500">
      <span>{total} ร้าน</span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
        >
          ก่อนหน้า
        </button>
        <span>
          {page}/{pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
