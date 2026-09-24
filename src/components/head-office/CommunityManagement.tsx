import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { getAdminAccessContext, hasAdminPermission, type AdminAccessContext } from "@/lib/adminAccess";
import {
  assignCommunityModerator,
  createCommunity,
  getCommunity,
  listCommunities,
  revokeCommunityModerator,
  setCommunityStatus,
  updateCommunity,
  type CommunityDetail,
  type CommunityInput,
  type CommunityListItem,
  type CommunityStatus,
} from "@/lib/communityAdmin";

const EMPTY_FORM: CommunityInput = {
  slug: "", name: "", description: "", privacy_mode: "member-only", boundary_type: "neighborhood",
  geography_summary: "", province: "กรุงเทพมหานคร", district: "", subdistrict: "", village: "", soi: "", condo: "",
  location_precision: "community-centroid", parent_community_id: null, reason: "",
};

const STATUS_LABEL: Record<CommunityStatus, string> = { draft: "ฉบับร่าง", active: "ใช้งาน", inactive: "ปิดใช้งาน", archived: "เก็บถาวร" };
const PRIVACY_LABEL = { "public-preview": "Public preview", "member-only": "Member only", "moderator-only": "Moderator only" } as const;

export function CommunityManagement() {
  const [access, setAccess] = useState<AdminAccessContext | null>(null);
  const [items, setItems] = useState<CommunityListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<CommunityInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const canCreate = access ? hasAdminPermission(access, "communities.create") : false;
  const canUpdate = access ? hasAdminPermission(access, "communities.update") : false;
  const canAction = access ? hasAdminPermission(access, "communities.action") : false;
  const canAdmin = access ? hasAdminPermission(access, "communities.admin") : false;

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await listCommunities({ search, status, privacy, sort, page });
      setItems(result.items); setTotal(result.total);
    } catch (e) { setError(e instanceof Error ? e.message : "โหลดชุมชนไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [page, privacy, search, sort, status]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setError(null);
    try { setDetail(await getCommunity(id)); }
    catch (e) { setError(e instanceof Error ? e.message : "โหลดรายละเอียดไม่สำเร็จ"); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { void getAdminAccessContext().then(setAccess); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void loadList(), 250); return () => window.clearTimeout(timer); }, [loadList]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [loadDetail, selectedId]);

  const pages = Math.max(1, Math.ceil(total / 20));
  const selected = detail?.community;
  const geography = useMemo(() => selected ? [selected.village, selected.soi, selected.condo, selected.subdistrict, selected.district, selected.province].filter(Boolean).join(" · ") : "", [selected]);

  function openCreate() { setForm({ ...EMPTY_FORM }); setFormMode("create"); }
  function openEdit() {
    if (!selected) return;
    setForm({
      name: selected.name, description: selected.description ?? "", privacy_mode: selected.privacy_mode,
      boundary_type: selected.boundary_type, geography_summary: selected.geography_summary ?? "", province: selected.province ?? "",
      district: selected.district ?? "", subdistrict: selected.subdistrict ?? "", village: selected.village ?? "", soi: selected.soi ?? "",
      condo: selected.condo ?? "", location_precision: selected.location_precision, parent_community_id: selected.parent_community_id, reason: "",
    });
    setFormMode("edit");
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      if (formMode === "create") {
        const id = await createCommunity(form); setSelectedId(id);
      } else if (selectedId) await updateCommunity(selectedId, form);
      setFormMode(null); await loadList(); if (selectedId) await loadDetail(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function changeStatus(next: CommunityStatus) {
    if (!selectedId || !selected) return;
    const reason = window.prompt(`เหตุผลที่เปลี่ยนสถานะ “${selected.name}” เป็น ${STATUS_LABEL[next]}`);
    if (!reason) return;
    if ((next === "inactive" || next === "archived") && !window.confirm("การเปลี่ยนสถานะนี้มีผลต่อการเข้าถึงชุมชน ยืนยันดำเนินการหรือไม่?")) return;
    setSaving(true); setError(null);
    try { await setCommunityStatus(selectedId, next, reason); await Promise.all([loadList(), loadDetail(selectedId)]); }
    catch (e) { setError(e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function assignModerator() {
    if (!selectedId) return;
    const customerId = window.prompt("Customer ID ของสมาชิกที่ต้องการแต่งตั้ง"); if (!customerId) return;
    const reason = window.prompt("เหตุผลในการแต่งตั้ง (บันทึก Audit)"); if (!reason) return;
    setSaving(true);
    try { await assignCommunityModerator(selectedId, customerId.trim(), "moderator", reason); await loadDetail(selectedId); }
    catch (e) { setError(e instanceof Error ? e.message : "แต่งตั้ง Moderator ไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function revokeModerator(customerId: string, name: string | null) {
    if (!selectedId || !window.confirm(`ยกเลิกสิทธิ์ Moderator ของ ${name || customerId}?`)) return;
    const reason = window.prompt("เหตุผลในการยกเลิกสิทธิ์ (บันทึก Audit)"); if (!reason) return;
    setSaving(true);
    try { await revokeCommunityModerator(selectedId, customerId, reason); await loadDetail(selectedId); }
    catch (e) { setError(e instanceof Error ? e.message : "ยกเลิก Moderator ไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-sm font-medium text-emerald-700">Community Management</p><h2 className="mt-1 text-2xl font-bold">ชุมชนทั้งหมด</h2><p className="mt-1 text-sm text-gray-500">บริหาร lifecycle, privacy, geography และ Moderator โดยไม่เปิดเผยข้อมูลสมาชิกเกินจำเป็น</p></div>
          {canCreate && <button type="button" onClick={openCreate} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">+ สร้างชุมชน</button>}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="ค้นหาชื่อ, slug หรือพื้นที่" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="">ทุกสถานะ</option><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option><option value="draft">ฉบับร่าง</option><option value="archived">เก็บถาวร</option></select>
          <select value={privacy} onChange={(e) => { setPrivacy(e.target.value); setPage(1); }} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="">ทุก Privacy</option><option value="public-preview">Public preview</option><option value="member-only">Member only</option><option value="moderator-only">Moderator only</option></select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="updated_desc">อัปเดตล่าสุด</option><option value="name_asc">ชื่อ A–Z</option><option value="name_desc">ชื่อ Z–A</option><option value="members_desc">สมาชิกมากสุด</option><option value="created_desc">สร้างล่าสุด</option></select>
        </div>
      </section>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => void loadList()} className="ml-3 font-semibold underline">ลองใหม่</button></div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {loading ? <Loading label="กำลังโหลดรายชื่อชุมชน..." /> : items.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">ชุมชน</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">Privacy</th><th className="px-4 py-3 text-right">สมาชิก</th><th className="px-4 py-3 text-right">Moderator</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map((item) => <tr key={item.community_id} onClick={() => setSelectedId(item.community_id)} className={`cursor-pointer hover:bg-gray-50 ${selectedId === item.community_id ? "bg-emerald-50" : ""}`}><td className="px-4 py-4"><p className="font-semibold text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">{item.slug} · {item.geography_summary || item.boundary_type}</p></td><td className="px-4 py-4"><StatusBadge status={item.status} /></td><td className="px-4 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs">{PRIVACY_LABEL[item.privacy_mode]}</span></td><td className="px-4 py-4 text-right tabular-nums">{item.member_count}</td><td className="px-4 py-4 text-right tabular-nums">{item.moderator_count}</td></tr>)}</tbody></table></div>
          )}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500"><span>{total} ชุมชน</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((v) => v - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">ก่อนหน้า</button><span>{page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage((v) => v + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">ถัดไป</button></div></div>
        </section>

        <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          {!selectedId ? <div className="py-16 text-center text-sm text-gray-500">เลือกชุมชนเพื่อดูรายละเอียด</div> : detailLoading || !detail ? <Loading label="กำลังโหลดรายละเอียด..." /> : <div className="space-y-6">
            <div><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-gray-400">{selected?.slug}</p><h3 className="mt-1 text-xl font-bold">{selected?.name}</h3></div><StatusBadge status={selected!.status} /></div><p className="mt-3 text-sm leading-6 text-gray-600">{selected?.description || "ยังไม่มีคำอธิบาย"}</p><p className="mt-2 text-xs text-gray-500">{geography || selected?.geography_summary || "ยังไม่มีข้อมูลพื้นที่"}</p><p className="mt-1 text-xs text-gray-400">พิกัดแสดงแบบประมาณเท่านั้น: {selected?.approx_center_lat ?? "—"}, {selected?.approx_center_lng ?? "—"}</p></div>
            <div className="grid grid-cols-2 gap-3"><Metric label="สมาชิก Active" value={detail.membership_summary.active ?? 0} /><Metric label="Moderator Active" value={detail.moderators.filter((m) => m.status === "active").length} /></div>
            <div className="flex flex-wrap gap-2">{canUpdate && <button onClick={openEdit} className="rounded-xl border px-3 py-2 text-sm font-medium">แก้ไข</button>}{canAction && selected?.status !== "active" && <button disabled={saving} onClick={() => void changeStatus("active")} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white">เปิดใช้งาน</button>}{canAction && selected?.status === "active" && <button disabled={saving} onClick={() => void changeStatus("inactive")} className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700">ปิดใช้งาน</button>}{canAction && selected?.status !== "archived" && <button disabled={saving} onClick={() => void changeStatus("archived")} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600">เก็บถาวร</button>}</div>
            <section><div className="flex items-center justify-between"><h4 className="font-semibold">Moderators</h4>{canAdmin && <button onClick={() => void assignModerator()} className="text-sm font-semibold text-emerald-700">+ แต่งตั้ง</button>}</div><div className="mt-3 space-y-2">{detail.moderators.length === 0 ? <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">ยังไม่มี Moderator</p> : detail.moderators.map((m) => <div key={m.assignment_id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{m.name || "ไม่ระบุชื่อ"}</p><p className="truncate text-xs text-gray-400">{m.moderator_role} · {m.status}</p></div>{canAdmin && m.status === "active" && <button onClick={() => void revokeModerator(m.customer_id, m.name)} className="text-xs font-semibold text-red-600">ยกเลิก</button>}</div>)}</div></section>
            <section><h4 className="font-semibold">Membership status</h4><div className="mt-3 flex flex-wrap gap-2">{Object.entries(detail.membership_summary).map(([key, value]) => <span key={key} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{key}: {value}</span>)}</div></section>
            <section><h4 className="font-semibold">Audit activity</h4><div className="mt-3 space-y-3">{detail.audit_activity.length === 0 ? <p className="text-sm text-gray-500">ยังไม่มีกิจกรรม</p> : detail.audit_activity.slice(0, 8).map((a) => <div key={a.audit_id} className="border-l-2 border-gray-200 pl-3"><p className="text-sm font-medium">{a.action}</p><p className="text-xs text-gray-500">{a.reason || "ไม่ระบุเหตุผล"} · {new Date(a.created_at).toLocaleString("th-TH")}</p></div>)}</div></section>
          </div>}
        </aside>
      </div>

      {formMode && <CommunityForm mode={formMode} value={form} saving={saving} onChange={setForm} onCancel={() => setFormMode(null)} onSubmit={submitForm} />}
    </div>
  );
}

function CommunityForm({ mode, value, saving, onChange, onCancel, onSubmit }: { mode: "create" | "edit"; value: CommunityInput; saving: boolean; onChange: (v: CommunityInput) => void; onCancel: () => void; onSubmit: (e: FormEvent) => void }) {
  const field = (key: keyof CommunityInput) => ({ value: String(value[key] ?? ""), onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...value, [key]: e.target.value }) });
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-gray-950/40 p-0 sm:items-center sm:p-6"><form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{mode === "create" ? "สร้างชุมชน" : "แก้ไขชุมชน"}</h3><button type="button" onClick={onCancel} className="h-9 w-9 rounded-full border text-xl">×</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{mode === "create" && <Field label="Slug"><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" {...field("slug")} className="input" /></Field>}<Field label="ชื่อชุมชน"><input required minLength={2} {...field("name")} className="input" /></Field><Field label="Privacy"><select {...field("privacy_mode")} className="input"><option value="public-preview">Public preview</option><option value="member-only">Member only</option><option value="moderator-only">Moderator only</option></select></Field><Field label="ประเภทพื้นที่"><select {...field("boundary_type")} className="input"><option value="village">หมู่บ้าน</option><option value="soi">ซอย</option><option value="condo">คอนโด</option><option value="neighborhood">Neighborhood</option><option value="district">เขต</option><option value="subdistrict">แขวง</option><option value="service-area">Service area</option><option value="organization">Organization</option></select></Field><Field label="ความละเอียดตำแหน่ง"><select {...field("location_precision")} className="input"><option value="community-centroid">Community centroid</option><option value="block">Block</option><option value="entrance">Entrance</option><option value="hidden">Hidden</option><option value="exact">Exact (ใช้เมื่อจำเป็นเท่านั้น)</option></select></Field>{(["province","district","subdistrict","village","soi","condo"] as const).map((key) => <Field key={key} label={{ province: "จังหวัด", district: "เขต/อำเภอ", subdistrict: "แขวง/ตำบล", village: "หมู่บ้าน", soi: "ซอย", condo: "คอนโด" }[key]}><input {...field(key)} className="input" /></Field>)}<div className="sm:col-span-2"><Field label="สรุปพื้นที่"><input {...field("geography_summary")} className="input" /></Field></div><div className="sm:col-span-2"><Field label="คำอธิบาย"><textarea rows={3} {...field("description")} className="input" /></Field></div><div className="sm:col-span-2"><Field label="เหตุผลการเปลี่ยนแปลง (Audit)"><input required {...field("reason")} className="input" /></Field></div></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm">ยกเลิก</button><button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึก"}</button></div></form></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-gray-700"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-gray-50 p-4"><p className="text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-gray-500">{label}</p></div>; }
function Loading({ label }: { label: string }) { return <div role="status" className="py-16 text-center text-sm text-gray-500"><div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />{label}</div>; }
function Empty() { return <div className="py-16 text-center"><p className="font-semibold">ไม่พบชุมชน</p><p className="mt-1 text-sm text-gray-500">ปรับคำค้นหาหรือตัวกรอง แล้วลองอีกครั้ง</p></div>; }
function StatusBadge({ status }: { status: CommunityStatus }) { const color = status === "active" ? "bg-emerald-100 text-emerald-700" : status === "inactive" ? "bg-amber-100 text-amber-700" : status === "archived" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{STATUS_LABEL[status]}</span>; }
