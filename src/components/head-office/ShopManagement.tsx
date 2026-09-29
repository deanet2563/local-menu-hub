import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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
  const [sort, setSort] = useState("created_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await getShop(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดรายละเอียดร้านไม่สำเร็จ");
    } finally {
      setDetailLoading(false);
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
    if (selected) void loadDetail(selected);
    else setDetail(null);
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
      await Promise.all([load(), loadDetail(selected)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remindShop() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await sendShopProfileReminder(selected);
      setNotice(
        result.ok
          ? "ส่ง LINE แจ้งร้านให้กรอกข้อมูลเรียบร้อยแล้ว"
          : "สร้างรายการแจ้งเตือนแล้ว",
      );
      await loadDetail(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งแจ้งเตือนไม่สำเร็จ");
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
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
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
              remindShop={remindShop}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function ShopDetailPanel({
  detail,
  canAction,
  saving,
  act,
  remindShop,
}: {
  detail: ShopDetail;
  canAction: boolean;
  saving: boolean;
  act: (
    action: ShopLifecycleAction,
    label: string,
    danger?: boolean,
  ) => Promise<void>;
  remindShop: () => Promise<void>;
}) {
  const shop = detail.shop;
  const missing = detail.readiness?.missing ?? [];

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
                ? "ข้อมูลบังคับครบ พร้อมให้ Admin อนุมัติ"
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
              <li key={key}>
                • {SHOP_READINESS_LABELS[key] ?? key}
              </li>
            ))}
          </ul>
        )}

        {canAction && !detail.readiness.ready && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void remindShop()}
            className="mt-4 w-full rounded-xl bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            แจ้งร้านให้กรอกข้อมูลให้ครบ
          </button>
        )}
      </section>

      <Block title="Contact & Location">
        <p>
          {String(shop.phone || "ไม่มีเบอร์")} ·{" "}
          {String(shop.email || "ไม่มีอีเมล")}
        </p>
        <p className="mt-1">
          {String(
            shop.address ||
              [shop.village, shop.soi, shop.zone].filter(Boolean).join(" · ") ||
              "ไม่มีที่อยู่",
          )}
        </p>
        <p className="mt-1 text-xs">
          พิกัด: {String(shop.lat ?? "—")}, {String(shop.lng ?? "—")} · อัปเดต{" "}
          {fmt(shop.location_updated_at)}
        </p>
      </Block>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Menu" value={detail.menu.total} />
        <Metric label="Orders" value={detail.commerce.total_orders} />
        <Metric label="Reviews" value={detail.reviews.count} />
      </div>

      <Block title="Owner / Staff">
        {detail.staff.length ? (
          detail.staff.map((item) => (
            <div key={item.customer_id} className="mb-2">
              <b>{item.name || item.customer_id}</b> · {item.role}
              <p className="text-xs">{item.phone || "ไม่มีเบอร์"}</p>
            </div>
          ))
        ) : (
          <p>ยังไม่มี Staff linkage</p>
        )}
      </Block>

      <Block title="Commerce summary">
        <p>
          Pending orders: {detail.commerce.pending_orders} · Paid orders:{" "}
          {detail.commerce.paid_orders}
        </p>
        <p>
          Rating: {detail.reviews.average_rating ?? "—"} ({detail.reviews.count}{" "}
          รีวิว)
        </p>
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
            <button
              disabled={saving || !detail.readiness.ready}
              onClick={() => void act("approve", "อนุมัติร้าน")}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {detail.readiness.ready ? "Approve" : "Approve ไม่ได้ — ข้อมูลไม่ครบ"}
            </button>
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
          <p>ไม่มีข้อมูล หรือไม่มีสิทธิ์ system.audit.read</p>
        )}
      </Block>
    </div>
  );
}

function Badge({ item }: { item: ShopListItem }) {
  const [text, className] = item.is_banned
    ? ["Banned", "bg-red-100 text-red-700"]
    : item.is_approved
      ? ["Approved", "bg-emerald-100 text-emerald-700"]
      : ["Pending", "bg-amber-100 text-amber-700"];

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
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
