import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getAdminAccessContext,
  hasAdminPermission,
  type AdminAccessContext,
} from "@/lib/adminAccess";
import {
  getRider,
  listRiders,
  riderLifecycle,
  type RiderDetail,
  type RiderLifecycleAction,
  type RiderListItem,
  type RiderMetric,
} from "@/lib/riderAdmin";

const fmt = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function duration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const mins = Math.max(0, Math.floor(seconds / 60));
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  const remain = mins % 60;
  return `${hours} ชม. ${remain} นาที`;
}

function metricText(metric: RiderMetric, durationMetric = false) {
  if (!metric?.available) return "Unavailable";
  if (metric.value === null || metric.value === undefined) return "—";
  if (durationMetric) return duration(Number(metric.value));
  return String(metric.value);
}

function metricReason(reason?: string) {
  const labels: Record<string, string> = {
    no_per_rider_offer_recipient_history: "ยังไม่มีประวัติผู้รับ offer ราย Rider",
    historical_offer_accept_denominator_incomplete: "denominator ประวัติ accept ยังไม่ครบ",
    canonical_reassignment_denominator_not_complete: "ข้อมูล reassignment ยังไม่ครบสำหรับ KPI",
    no_canonical_incident_linkage: "ยังไม่มี incident linkage ที่เป็น canonical",
  };
  return reason ? labels[reason] ?? reason : "";
}

export function RiderManagement() {
  const [access, setAccess] = useState<AdminAccessContext | null>(null);
  const [items, setItems] = useState<RiderListItem[]>([]);
  const [detail, setDetail] = useState<RiderDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(selected);
  const detailRequestRef = useRef(0);
  selectedRef.current = selected;

  const [search, setSearch] = useState("");
  const [approval, setApproval] = useState("");
  const [verification, setVerification] = useState("");
  const [online, setOnline] = useState("");
  const [riderClass, setRiderClass] = useState("");
  const [offersDelivery, setOffersDelivery] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canAction = !!access && hasAdminPermission(access, "riders.action");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listRiders({
        search,
        approval,
        verification,
        online,
        riderClass,
        offersDelivery,
        sort,
        page,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลด Rider ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [search, approval, verification, online, riderClass, offersDelivery, sort, page]);

  const loadDetail = useCallback(async (id: string) => {
    if (selectedRef.current !== id) return;
    const requestId = ++detailRequestRef.current;
    setDetail(null);
    setDetailLoading(true);
    setError(null);
    try {
      const next = await getRider(id);
      if (requestId !== detailRequestRef.current || selectedRef.current !== id) return;
      setDetail(next);
    } catch (cause) {
      if (requestId !== detailRequestRef.current || selectedRef.current !== id) return;
      setDetail(null);
      setError(cause instanceof Error ? cause.message : "โหลดรายละเอียด Rider ไม่สำเร็จ");
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

  async function act(action: RiderLifecycleAction, label: string, highRisk = true) {
    if (!selected) return;
    const reason = window.prompt(`เหตุผลในการ${label} (บันทึก Audit)`);
    if (!reason?.trim()) return;
    if (highRisk && !window.confirm(`ยืนยันการ${label} Rider รายนี้หรือไม่?`)) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await riderLifecycle(selected, action, reason.trim());
      await Promise.all([load(), loadDetail(selected)]);
      setNotice(`${label}สำเร็จ และบันทึก Audit แล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-emerald-700">Rider Operations · Delivery V3</p>
        <h2 className="mt-1 text-2xl font-bold">Rider Operations</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-500">
          หน้านี้เป็น observation / governance surface ของ Rider First Accept เท่านั้น
          ไม่มีปุ่ม force-assign และไม่เขียน assigned_rider_id จาก Head Office
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="ชื่อ / เบอร์ / Rider ID / ทะเบียน"
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
          <Filter
            value={approval}
            onChange={(value) => {
              setApproval(value);
              setPage(1);
            }}
            options={[
              ["", "ทุก Approval"],
              ["approved", "Approved"],
              ["pending", "Pending"],
              ["banned", "Banned"],
            ]}
          />
          <Filter
            value={verification}
            onChange={(value) => {
              setVerification(value);
              setPage(1);
            }}
            options={[
              ["", "ทุก Verification"],
              ["verified", "Verified"],
              ["unverified", "Unverified"],
              ["not_required", "Not required"],
            ]}
          />
          <Filter
            value={online}
            onChange={(value) => {
              setOnline(value);
              setPage(1);
            }}
            options={[
              ["", "Online + Offline"],
              ["online", "Online"],
              ["offline", "Offline"],
            ]}
          />
          <Filter
            value={riderClass}
            onChange={(value) => {
              setRiderClass(value);
              setPage(1);
            }}
            options={[
              ["", "ทุก Rider class"],
              ["general", "General"],
              ["public_win", "Public Win"],
            ]}
          />
          <Filter
            value={offersDelivery}
            onChange={(value) => {
              setOffersDelivery(value);
              setPage(1);
            }}
            options={[
              ["", "Delivery eligibility ทั้งหมด"],
              ["true", "offers_delivery = true"],
              ["false", "offers_delivery = false"],
            ]}
          />
          <Filter
            value={sort}
            onChange={setSort}
            options={[
              ["created_desc", "สร้างล่าสุด"],
              ["created_asc", "สร้างเก่าสุด"],
              ["name_asc", "ชื่อ A–Z"],
              ["name_desc", "ชื่อ Z–A"],
              ["location_desc", "Location update ล่าสุด"],
            ]}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium hover:bg-gray-100"
          >
            Refresh
          </button>
        </div>
      </section>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">
            ลองใหม่
          </button>
        </div>
      )}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(430px,.75fr)]">
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <State text="กำลังโหลด Rider..." />
          ) : items.length === 0 ? (
            <State text="ไม่พบ Rider ตามเงื่อนไข" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3">Rider</th>
                    <th className="px-4 py-3">Approval</th>
                    <th className="px-4 py-3">Verification</th>
                    <th className="px-4 py-3">Online</th>
                    <th className="px-4 py-3">Delivery</th>
                    <th className="px-4 py-3">Current job</th>
                    <th className="px-4 py-3">Location update</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((rider) => (
                    <tr
                      key={rider.rider_id}
                      onClick={() => setSelected(rider.rider_id)}
                      className={`cursor-pointer hover:bg-gray-50 ${selected === rider.rider_id ? "bg-emerald-50" : ""}`}
                    >
                      <td className="sticky left-0 bg-inherit px-4 py-4">
                        <p className="font-semibold">{rider.name}</p>
                        <p className="text-xs text-gray-500">{rider.phone}</p>
                        <p className="max-w-[220px] truncate text-[11px] text-gray-400">{rider.rider_id}</p>
                        <p className="mt-1 text-[11px] uppercase text-gray-400">{rider.rider_class}</p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={rider.is_banned ? "banned" : rider.is_approved ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={rider.verification_state} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={rider.is_online ? "online" : "offline"} />
                      </td>
                      <td className="px-4 py-4">
                        <span className={rider.offers_delivery ? "font-medium text-emerald-700" : "text-gray-400"}>
                          {rider.offers_delivery ? "Eligible" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {rider.current_job ? (
                          <div>
                            <StatusBadge value={rider.current_job.delivery_status} />
                            <p className="mt-1 max-w-[180px] truncate text-xs text-gray-500">{rider.current_job.shop_name}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-500">
                        {fmt(rider.location_updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t p-3 text-sm text-gray-500">
            <span>{total} Rider</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <span>{page}/{pages}</span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <State text="เลือก Rider เพื่อดูรายละเอียด" />
          ) : detailLoading || !detail ? (
            <State text="กำลังโหลดรายละเอียด..." />
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold">{detail.identity.name}</h3>
                    <p className="text-sm text-gray-500">{detail.identity.phone}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge value={detail.governance.is_banned ? "banned" : detail.governance.is_approved ? "approved" : "pending"} />
                    <StatusBadge value={detail.operational.is_online ? "online" : "offline"} />
                  </div>
                </div>
                <p className="mt-2 break-all text-xs text-gray-400">Rider: {detail.identity.rider_id}</p>
                <p className="mt-1 break-all text-xs text-gray-400">Customer: {detail.identity.customer_id}</p>
                <Link
                  to="/head-office/$section"
                  params={{ section: "members" }}
                  className="mt-2 inline-flex text-xs font-semibold text-emerald-700 underline"
                >
                  เปิด Member Management
                </Link>
              </div>

              <Block title="Profile & Verification">
                <Info label="Rider class" value={detail.profile.rider_class} />
                <Info label="Vehicle" value={detail.profile.vehicle_type} />
                <Info label="Plate" value={detail.profile.plate_number} />
                <Info label="Win registration" value={detail.profile.win_registration_no} />
                <Info label="Win zone" value={detail.profile.win_zone} />
                <Info label="offers_delivery" value={detail.profile.offers_delivery ? "true" : "false"} />
                <Info label="Verification" value={detail.profile.verification_state} />
                <Info label="Verified at" value={fmt(detail.profile.verified_at)} />
                {!detail.capabilities.verification_evidence && (
                  <p className="mt-3 rounded-xl bg-white p-2 text-xs text-gray-500">
                    Verification evidence / document image: Unavailable — ยังไม่มี canonical evidence source ใน Production
                  </p>
                )}
              </Block>

              <Block title="Operational status">
                <Info label="Canonical online state" value={detail.operational.is_online ? "Online" : "Offline"} />
                <Info label="Location updated" value={fmt(detail.operational.location_updated_at)} />
                <Info
                  label="Location age"
                  value={detail.operational.location_age_seconds === null ? "—" : duration(detail.operational.location_age_seconds)}
                />
                {detail.operational.precise_location ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-semibold">Precise operational location · restricted</p>
                    <p className="mt-1">
                      {String(detail.operational.precise_location.lat)}, {String(detail.operational.precise_location.lng)}
                    </p>
                    <p className="mt-1 text-amber-700">อัปเดต {fmt(detail.operational.precise_location.updated_at)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">
                    Precise location ไม่แสดงสำหรับสิทธิ์นี้ หรือยังไม่มีข้อมูลตำแหน่ง
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Online/Offline ใช้ค่า canonical <code>riders.is_online</code> โดยตรง ไม่ derive จาก last activity
                </p>
              </Block>

              <Block title="Current delivery">
                {detail.current_job ? (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={detail.current_job.delivery_status} />
                      <span className="font-medium text-gray-900">{detail.current_job.shop_name}</span>
                    </div>
                    <Info label="Sub-order" value={detail.current_job.sub_id} />
                    <Info label="Order status" value={detail.current_job.order_status} />
                    <Info label="Accepted / called" value={fmt(detail.current_job.rider_called_at)} />
                    <Info label="Picked up" value={fmt(detail.current_job.picked_up_at)} />
                    <Info label="Elapsed" value={duration(detail.current_job.elapsed_seconds)} />
                    <Info label="Proof" value={detail.current_job.proof_present ? "Present" : "Not yet"} />
                    <p className="mt-2 text-xs text-gray-500">
                      Observation only — Head Office ไม่มี direct assignment override
                    </p>
                  </div>
                ) : (
                  <p>ไม่มี active assignment</p>
                )}
              </Block>

              <Block title="Quality / KPI foundation">
                {detail.kpi.coverage_started_at && (
                  <p className="mb-3 text-xs text-gray-500">
                    Event-history coverage ตั้งแต่ {fmt(detail.kpi.coverage_started_at)}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Accepted" metric={detail.kpi.jobs_accepted} />
                  <Metric label="Completed" metric={detail.kpi.completed} />
                  <Metric label="Rider cancels" metric={detail.kpi.rider_cancellations} />
                  <Metric label="Jobs offered" metric={detail.kpi.jobs_offered} />
                  <Metric label="Accept → Pickup" metric={detail.kpi.accept_to_pickup_seconds} durationMetric />
                  <Metric label="Pickup → Delivery" metric={detail.kpi.pickup_to_delivery_seconds} durationMetric />
                  <Metric label="Completion rate" metric={detail.kpi.completion_rate} />
                  <Metric label="Reassignments" metric={detail.kpi.reassignments} />
                  <Metric label="Serious incidents" metric={detail.kpi.serious_incidents} />
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  ไม่มีคะแนน “ดี/แย่” และ metric ที่ source ไม่พอจะแสดง Unavailable แทนการเดา
                </p>
              </Block>

              <Block title="Governance">
                <Info label="Approved" value={detail.governance.is_approved ? "Yes" : "No"} />
                <Info label="Banned" value={detail.governance.is_banned ? "Yes" : "No"} />
                <Info label="Ban reason" value={detail.governance.banned_reason} />
                <Info label="Deletion requested" value={fmt(detail.governance.deletion_requested_at)} />
                <Info label="Deletion reason" value={detail.governance.deletion_reason} />

                {canAction && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!detail.governance.is_approved && !detail.governance.is_banned && (
                      <ActionButton
                        disabled={saving}
                        onClick={() => void act("approve", "อนุมัติ Rider")}
                      >
                        Approve
                      </ActionButton>
                    )}
                    {detail.profile.rider_class === "public_win" &&
                      detail.profile.verification_state === "unverified" && (
                        <ActionButton
                          disabled={
                            saving ||
                            !detail.profile.plate_number ||
                            !detail.profile.win_registration_no
                          }
                          onClick={() => void act("verify", "ยืนยันเอกสาร Rider")}
                        >
                          Verify
                        </ActionButton>
                      )}
                    {!detail.governance.is_banned ? (
                      <ActionButton
                        danger
                        disabled={saving}
                        onClick={() => void act("ban", "ระงับ Rider")}
                      >
                        Ban
                      </ActionButton>
                    ) : (
                      <ActionButton
                        disabled={saving}
                        onClick={() => void act("unban", "ยกเลิกการระงับ Rider")}
                      >
                        Unban
                      </ActionButton>
                    )}
                    {detail.governance.deletion_requested_at && (
                      <ActionButton
                        disabled={saving}
                        onClick={() => void act("deletion_reject", "ปฏิเสธคำขอลบ Rider")}
                      >
                        Reject deletion
                      </ActionButton>
                    )}
                  </div>
                )}

                {detail.governance.deletion_requested_at && !detail.capabilities.deletion_approval && (
                  <p className="mt-3 text-xs text-gray-500">
                    Deletion approval / hard delete: Unavailable — canonical contract ปัจจุบันรองรับเฉพาะ reject request และต้องรักษาประวัติ order/delivery
                  </p>
                )}
              </Block>

              <Block title="Recent delivery jobs">
                {detail.recent_jobs.length === 0 ? (
                  <p>ยังไม่มีประวัติงานที่เชื่อมกับ Rider นี้</p>
                ) : (
                  <div className="space-y-3">
                    {detail.recent_jobs.slice(0, 10).map((job) => (
                      <div key={job.sub_id} className="border-l-2 border-gray-200 pl-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{job.shop_name}</span>
                          <StatusBadge value={job.delivery_status} />
                        </div>
                        <p className="mt-1 break-all text-xs text-gray-500">{job.sub_id}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Pickup {fmt(job.picked_up_at)} · Delivered {fmt(job.delivered_at)} · Proof {job.proof_present ? "Yes" : "No"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Block>

              <Block title="Delivery event history">
                {detail.events.length === 0 ? (
                  <p>ยังไม่มี canonical Rider event history สำหรับรายนี้</p>
                ) : (
                  <div className="space-y-3">
                    {detail.events.slice(0, 15).map((event) => (
                      <div key={event.event_id} className="border-l-2 border-gray-200 pl-3">
                        <p className="font-medium text-gray-900">{event.event_type}</p>
                        <p className="text-xs text-gray-500">
                          {event.from_delivery_status ?? "—"} → {event.to_delivery_status ?? "—"} · {fmt(event.occurred_at)}
                        </p>
                        {(event.reason_code || event.reason_note) && (
                          <p className="mt-1 text-xs text-gray-500">
                            Reason: {event.reason_code ?? "—"} {event.reason_note ? `· ${event.reason_note}` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Block>

              <Block title="Admin audit">
                {detail.audit.length === 0 ? (
                  <p>ไม่มีข้อมูล หรือบัญชีนี้ไม่มีสิทธิ์ system.audit.read</p>
                ) : (
                  <div className="space-y-3">
                    {detail.audit.slice(0, 12).map((entry) => (
                      <div key={entry.audit_id} className="border-l-2 border-gray-200 pl-3">
                        <p className="font-medium text-gray-900">{entry.action}</p>
                        <p className="text-xs text-gray-500">
                          {fmt(entry.created_at)} · {entry.reason || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Block>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Filter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border px-3 py-2.5 text-sm"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function State({ text }: { text: string }) {
  return <div className="p-10 text-center text-sm text-gray-500">{text}</div>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
      <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="mt-1 grid grid-cols-[140px_minmax(0,1fr)] gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="break-words text-gray-900">{value || "—"}</span>
    </div>
  );
}

function Metric({
  label,
  metric,
  durationMetric = false,
}: {
  label: string;
  metric: RiderMetric;
  durationMetric?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 font-semibold ${metric.available ? "text-gray-900" : "text-gray-400"}`}>
        {metricText(metric, durationMetric)}
      </p>
      {!metric.available && metric.reason && (
        <p className="mt-1 text-[10px] leading-4 text-gray-400">{metricReason(metric.reason)}</p>
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const palette: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700",
    verified: "bg-emerald-100 text-emerald-700",
    online: "bg-emerald-100 text-emerald-700",
    delivered: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    unverified: "bg-amber-100 text-amber-700",
    rider_called: "bg-sky-100 text-sky-700",
    picked_up: "bg-blue-100 text-blue-700",
    banned: "bg-red-100 text-red-700",
    failed: "bg-red-100 text-red-700",
    offline: "bg-gray-100 text-gray-600",
    not_required: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${palette[value] ?? "bg-gray-100 text-gray-600"}`}>
      {value}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-40 ${
        danger
          ? "border-red-300 text-red-700 hover:bg-red-50"
          : "border-gray-300 text-gray-700 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}
