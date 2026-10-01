import { useCallback, useEffect, useState } from "react";
import { getAdminAccessContext, hasAdminPermission, type AdminAccessContext } from "@/lib/adminAccess";
import {
  getModerationCase,
  listModerationCases,
  type ModerationCaseDetail,
  type ModerationCaseListItem,
  type ModerationCategory,
} from "@/lib/moderationAdmin";

const PAGE_SIZE = 20;
const TARGET_LABEL: Record<string, string> = {
  member: "สมาชิก",
  shop: "ร้านค้า",
  rider: "ไรเดอร์",
  shop_review: "รีวิวร้าน",
};
const STATUS_LABEL: Record<string, string> = {
  open: "รอตรวจสอบ",
  in_review: "กำลังตรวจสอบ",
  escalated: "ส่งต่อ",
  resolved: "ปิดเคสแล้ว",
};
const CATEGORY_LABEL: Record<ModerationCategory, string> = {
  spam: "สแปม",
  scam_fraud_concern: "ข้อกังวลเรื่องฉ้อโกง",
  harassment: "คุกคาม",
  impersonation: "แอบอ้างตัวตน",
  inappropriate_content: "เนื้อหาไม่เหมาะสม",
  prohibited_listing: "รายการต้องห้าม",
  privacy_issue: "ละเมิดความเป็นส่วนตัว",
  misinformation_local_safety_concern: "ข้อมูลผิดหรือความปลอดภัยในพื้นที่",
  duplicate: "รายงานซ้ำ",
  other: "อื่น ๆ",
};

const fmt = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-medium text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-900">{children || "—"}</dd></div>;
}

function CaseDetail({ detail, loading, error }: { detail: ModerationCaseDetail | null; loading: boolean; error: boolean }) {
  if (loading) return <p className="p-5 text-sm text-gray-500">กำลังโหลดรายละเอียดเคส…</p>;
  if (error) return <div className="p-5 text-sm text-amber-800" role="status">อ่านรายละเอียดไม่ได้ หรือ endpoint ยังไม่พร้อม</div>;
  if (!detail) return <p className="p-5 text-sm text-gray-500">เลือกเคสเพื่อดูรายงาน ประวัติ และข้อมูลที่ได้รับอนุญาต</p>;

  const target = detail.target ?? {};
  const reviewText = typeof target.review_text === "string" ? target.review_text : null;
  const targetName = typeof target.name === "string" ? target.name : null;
  const shopName = typeof target.shop_name === "string" ? target.shop_name : null;
  const visibility = typeof target.visibility_state === "string" ? target.visibility_state : null;
  const memberState = typeof target.is_banned === "boolean" && typeof target.is_suspended === "boolean"
    ? target.is_banned ? "ถูกแบน" : target.is_suspended ? "ถูกระงับ" : "ใช้งานอยู่"
    : null;
  const shopState = typeof target.is_banned === "boolean" && typeof target.is_approved === "boolean"
    ? target.is_banned ? "ถูกแบน" : target.is_approved ? "อนุมัติแล้ว" : "รออนุมัติ"
    : null;
  const riderState = typeof target.is_banned === "boolean" && typeof target.is_approved === "boolean"
    ? target.is_banned ? "ถูกแบน" : target.is_approved ? "อนุมัติแล้ว" : "รออนุมัติ"
    : null;
  const targetState = visibility ?? (detail.case.target_type === "member" ? memberState : detail.case.target_type === "shop" ? shopState : detail.case.target_type === "rider" ? riderState : null);

  return (
    <div className="divide-y divide-gray-100">
      <section className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-xs font-medium text-gray-500">Case ID</p><code className="break-all text-xs text-gray-700">{detail.case.case_id}</code></div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{STATUS_LABEL[detail.case.status] ?? detail.case.status}</span>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="ประเภทเป้าหมาย">{TARGET_LABEL[detail.case.target_type] ?? detail.case.target_type}</Field>
          <Field label="Target ID">{detail.case.target_id}</Field>
          <Field label="Community ID">{detail.case.community_id}</Field>
          <Field label="สถานะปัจจุบัน">{targetState ?? (detail.case.target_type === "shop_review" ? "อ่านได้อย่างเดียว" : "ไม่มีข้อมูลสถานะตามสิทธิ์")}</Field>
          <Field label="สร้างเคส">{fmt(detail.case.created_at)}</Field>
          <Field label="ตรวจล่าสุด">{fmt(detail.case.reviewed_at)}</Field>
          <Field label="ผลการพิจารณา">{detail.case.decision}</Field>
        </dl>
        {(targetName || reviewText || detail.target_owner) && (
          <div className="rounded-2xl bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">เป้าหมาย</h4>
            {targetName && <p className="mt-2 text-sm">{targetName}</p>}
            {reviewText && <blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-gray-300 pl-3 text-sm text-gray-700">{reviewText}</blockquote>}
            {detail.target_owner && <p className="mt-3 text-xs text-gray-600">เจ้าของ: {detail.target_owner.name || "ไม่ระบุชื่อ"}{detail.target_owner.phone ? ` · ${detail.target_owner.phone}` : ""}</p>}
            {shopName && <p className="mt-2 text-xs text-gray-600">ร้าน: {shopName}</p>}
          </div>
        )}
      </section>

      <section className="p-5">
        <h4 className="font-semibold text-gray-900">รายงาน ({detail.reports.length})</h4>
        {detail.reports.length === 0 ? <p className="mt-2 text-sm text-gray-500">ไม่มีรายการรายงาน</p> : <ul className="mt-3 space-y-3">{detail.reports.map((report) => (
          <li key={report.report_id} className="rounded-2xl border border-gray-100 p-3">
            <div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-medium">{CATEGORY_LABEL[report.category] ?? report.category}</span><time className="text-xs text-gray-500">{fmt(report.created_at)}</time></div>
            <code className="mt-1 block break-all text-[11px] text-gray-400">Report ID: {report.report_id}</code>
            {report.submitted_note && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{report.submitted_note}</p>}
            {report.reporter?.name && <p className="mt-2 text-xs text-gray-500">ผู้รายงาน: {report.reporter.name}</p>}
            {report.reporter?.customer_id && <p className="text-xs text-gray-400">Reporter ID: {report.reporter.customer_id}</p>}
          </li>
        ))}</ul>}
      </section>

      <section className="p-5">
        <h4 className="font-semibold text-gray-900">ประวัติ moderation</h4>
        {detail.events.length === 0 ? <p className="mt-2 text-sm text-gray-500">ยังไม่มีประวัติการดำเนินการ</p> : <ol className="mt-3 space-y-3">{detail.events.map((event) => (
          <li key={event.event_id} className="border-l-2 border-gray-200 pl-3">
            <p className="text-sm font-medium">{event.action}</p><p className="text-xs text-gray-500">{fmt(event.created_at)}{event.actor_customer_id ? ` · ${event.actor_customer_id}` : ""}</p>
            {event.reason && <p className="mt-1 text-sm text-gray-700">{event.reason}</p>}
          </li>
        ))}</ol>}
      </section>

      <section className="p-5">
        <h4 className="font-semibold text-gray-900">หลักฐาน</h4>
        {detail.evidence.length === 0 ? <p className="mt-2 text-sm text-gray-500">ไม่มี metadata หลักฐานในเคสนี้</p> : <ul className="mt-2 space-y-2">{detail.evidence.map((evidence) => <li key={evidence.evidence_id} className="text-sm text-gray-700">อ้างอิง {evidence.evidence_id} · {fmt(evidence.created_at)}</li>)}</ul>}
        <p className="mt-2 text-xs text-gray-500">การเปิดไฟล์หลักฐานยังไม่พร้อม; หน้านี้ไม่ดึง public URL หรือ binary</p>
      </section>

      {detail.audit_activity.length > 0 && <section className="p-5">
        <h4 className="font-semibold text-gray-900">Audit</h4>
        <ul className="mt-2 space-y-3">{detail.audit_activity.map((audit) => <li key={audit.audit_id} className="text-sm"><span className="font-medium">{audit.action}</span><span className="ml-2 text-xs text-gray-500">{fmt(audit.created_at)} · {audit.actor_role_key}</span>{audit.reason && <p className="mt-1 text-gray-600">{audit.reason}</p>}</li>)}</ul>
      </section>}
    </div>
  );
}

export function ModerationCenter() {
  const [access, setAccess] = useState<AdminAccessContext | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [items, setItems] = useState<ModerationCaseListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModerationCaseDetail | null>(null);
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const canRead = !!access && hasAdminPermission(access, "moderation.read");
  const canFilterCommunity = !!access && hasAdminPermission(access, "communities.read");
  const invalidDateRange = !!createdFrom && !!createdTo && createdFrom > createdTo;
  const invalidCommunityId = canFilterCommunity && !!communityId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(communityId.trim());

  useEffect(() => {
    let active = true;
    void getAdminAccessContext().then((value) => { if (active) setAccess(value); }).catch(() => { if (active) setAccessError(true); });
    return () => { active = false; };
  }, []);

  const loadList = useCallback(async () => {
    if (!canRead) return;
    if ((createdFrom && createdTo && createdFrom > createdTo) || invalidCommunityId) {
      setItems([]); setTotal(0); setTotalPages(0); setSelectedId(null); setUnavailable(false); setLoading(false);
      return;
    }
    setLoading(true); setUnavailable(false);
    try {
      const result = await listModerationCases({ search, targetType, communityId: canFilterCommunity ? communityId : "", status, category, createdFrom, createdTo, sort, page, pageSize: PAGE_SIZE });
      setItems(result.items); setTotal(result.total); setTotalPages(result.totalPages);
      setSelectedId((current) => current && result.items.some((item) => item.case_id === current) ? current : null);
    } catch {
      setItems([]); setTotal(0); setTotalPages(0); setSelectedId(null); setUnavailable(true);
    } finally { setLoading(false); }
  }, [canFilterCommunity, canRead, category, communityId, createdFrom, createdTo, invalidCommunityId, page, search, sort, status, targetType]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(), 250);
    return () => window.clearTimeout(timer);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId || !canRead) { setDetail(null); return; }
    let active = true;
    setDetail(null); setDetailLoading(true); setDetailError(false);
    void getModerationCase(selectedId).then((value) => { if (active) setDetail(value); }).catch(() => { if (active) setDetailError(true); }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [canRead, selectedId]);

  function resetPage<T>(setter: (value: T) => void, value: T) { setter(value); setPage(1); setSelectedId(null); }

  if (accessError) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900" role="status">ตรวจสอบสิทธิ์ Platform Admin ไม่สำเร็จ จึงปิดการอ่านเคสไว้</div>;
  if (!access) return <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-500">กำลังตรวจสอบสิทธิ์…</div>;
  if (!canRead) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900" role="status">บัญชีนี้ไม่มีสิทธิ์ moderation.read</div>;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm font-semibold text-emerald-700">Moderation &amp; Safety Center</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Report queue</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">อ่านเคสและประวัติตามสิทธิ์ที่ได้รับ ข้อมูลผู้รายงานและรายละเอียดอ่อนไหวถูกจำกัดโดย read RPC</p></div>
          <span className="w-fit rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">Read only · {total} เคส</span>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5" aria-label="ตัวกรองเคส">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-gray-600">ค้นหา<input maxLength={120} value={search} onChange={(e) => resetPage(setSearch, e.target.value)} placeholder="Target, category, note" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-medium text-gray-600">ประเภทเป้าหมาย<select value={targetType} onChange={(e) => resetPage(setTargetType, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"><option value="">ทุกประเภท</option><option value="member">สมาชิก</option><option value="shop">ร้านค้า</option><option value="rider">ไรเดอร์</option><option value="shop_review">รีวิวร้าน</option></select></label>
          <label className="text-xs font-medium text-gray-600">สถานะ<select value={status} onChange={(e) => resetPage(setStatus, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"><option value="">ทุกสถานะ</option>{Object.entries(STATUS_LABEL).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label className="text-xs font-medium text-gray-600">หมวดรายงาน<select value={category} onChange={(e) => resetPage(setCategory, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"><option value="">ทุกหมวด</option>{Object.entries(CATEGORY_LABEL).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          {canFilterCommunity && <label className="text-xs font-medium text-gray-600">Community ID<input maxLength={36} value={communityId} onChange={(e) => resetPage(setCommunityId, e.target.value)} placeholder="UUID" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" /></label>}
          <label className="text-xs font-medium text-gray-600">ตั้งแต่<input type="date" value={createdFrom} onChange={(e) => resetPage(setCreatedFrom, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-medium text-gray-600">ถึง<input type="date" value={createdTo} onChange={(e) => resetPage(setCreatedTo, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-medium text-gray-600">เรียงลำดับ<select value={sort} onChange={(e) => resetPage(setSort, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"><option value="created_desc">ใหม่ไปเก่า</option><option value="created_asc">เก่าไปใหม่</option><option value="updated_desc">อัปเดตล่าสุด</option></select></label>
        </div>
        {invalidDateRange && <p className="mt-3 text-sm text-red-700" role="alert">วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด</p>}
        {invalidCommunityId && <p className="mt-3 text-sm text-red-700" role="alert">Community ID ต้องเป็น UUID ที่ถูกต้อง</p>}
      </section>

      {unavailable && <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="status"><h3 className="font-semibold">Moderation read endpoint ยังไม่พร้อม</h3><p className="mt-1">ปิดรายการและรายละเอียดเคสไว้ จนกว่าจะติดตั้ง schema/RPC และสิทธิ์อ่านครบ</p><button onClick={() => void loadList()} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold">ลองอีกครั้ง</button></section>}
      {!unavailable && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold">เคส ({total})</h3><p className="mt-1 text-xs text-gray-500">ไม่มี priority หรือ assignee ใน source ปัจจุบัน</p></div>
          {loading ? <p className="p-5 text-sm text-gray-500">กำลังโหลดคิว…</p> : items.length === 0 ? <div className="p-6 text-center"><p className="font-medium text-gray-800">ไม่มีเคสตามตัวกรอง</p><p className="mt-1 text-sm text-gray-500">คิวนี้แสดงเฉพาะ report/case ที่มีอยู่จริง</p></div> : <ul className="divide-y divide-gray-100">{items.map((item) => <li key={item.case_id}>
            <button onClick={() => setSelectedId(item.case_id)} aria-pressed={selectedId === item.case_id} className={`w-full p-4 text-left transition hover:bg-gray-50 ${selectedId === item.case_id ? "bg-emerald-50" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-gray-900">{item.target_label || TARGET_LABEL[item.target_type] || item.target_type}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{STATUS_LABEL[item.status] ?? item.status}</span></div>
              <p className="mt-1 text-xs text-gray-500">{TARGET_LABEL[item.target_type] ?? item.target_type}{item.target_id ? ` · ${item.target_id}` : ""} · {item.report_count} รายงาน</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{item.categories.map((value) => <span key={value} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800">{CATEGORY_LABEL[value] ?? value}</span>)}</div>
              <p className="mt-2 text-xs text-gray-500">รายงานล่าสุด {fmt(item.latest_report_at)} · เปิดเคส {fmt(item.created_at)}</p>
            </button>
          </li>)}</ul>}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-600"><span>หน้า {page}{totalPages ? ` / ${totalPages}` : ""}</span><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">ก่อนหน้า</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">ถัดไป</button></div></div>
        </section>
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold">รายละเอียดเคส</h3></div><CaseDetail detail={detail} loading={detailLoading} error={detailError} /></section>
      </div>}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm"><h3 className="font-semibold text-gray-900">โหมดอ่านอย่างเดียว</h3><p className="mt-1 leading-6">ยังไม่เปิด hide, remove, restore, warning, restriction, ban, unban, assignment หรือ appeal action. Review enforcement ยัง report-only, Member action ถูกปิดจน lifecycle/auth contract ครบ และ Shop/Rider ยังต้องเรียก lifecycle ของ module เจ้าของเท่านั้น</p><p className="mt-2 text-xs text-gray-500">หลักฐานแสดงเฉพาะ metadata; binary access, signed URL และ evidence upload ยัง unavailable</p></section>
    </div>
  );
}
