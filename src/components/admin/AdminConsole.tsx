import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, getCurrentCustomerId } from "@/lib/supabase";

// MyTree Admin Console
// Existing governance stays behind platform_admins + admin SECURITY DEFINER RPCs.
// This UI intentionally does not bypass RLS or write approval/ban columns directly.

type Tab = "shops" | "riders" | "customers" | "moderation";
type EntityFilter = "pending" | "active" | "blocked" | "all";

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("shops");

  return (
    <div className="mx-auto max-w-md pb-12">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-bold">🛡️ MyTree Admin</h1>
        <p className="mt-1 text-xs text-gray-500">อนุมัติ ตรวจสอบ ระงับ และดู Blacklist จากศูนย์เดียว</p>
      </div>

      <div className="sticky top-0 z-20 grid grid-cols-4 gap-1 border-y border-gray-100 bg-white px-3 py-2">
        {([
          ["shops", "🏪", "ร้าน"],
          ["riders", "🛵", "วิน"],
          ["customers", "👤", "ลูกค้า"],
          ["moderation", "🚩", "Report"],
        ] as [Tab, string, string][]).map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-1 py-2 text-center text-[11px] font-medium ${tab === key ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            <span className="block text-base">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "shops" && <ShopsTab />}
        {tab === "riders" && <RidersTab />}
        {tab === "customers" && <CustomersTab />}
        {tab === "moderation" && <ModerationTab />}
      </div>
    </div>
  );
}

function FilterBar({ value, onChange, counts }: {
  value: EntityFilter;
  onChange: (v: EntityFilter) => void;
  counts: { pending?: number; active: number; blocked: number; all: number };
}) {
  const items: [EntityFilter, string, number][] = [
    ["all", "ทั้งหมด", counts.all],
    ...(counts.pending === undefined ? [] : [["pending", "รออนุมัติ", counts.pending] as [EntityFilter, string, number]]),
    ["active", "ใช้งาน", counts.active],
    ["blocked", "Blacklist", counts.blocked],
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map(([key, label, count]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${value === key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          {label} {count}
        </button>
      ))}
    </div>
  );
}

function ReasonPrompt({ label, onSubmit, onCancel }: {
  label: string;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <textarea
        rows={3}
        className="w-full rounded-lg border border-red-100 bg-white p-2 text-sm"
        placeholder={label}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <button disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())} className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-medium text-white disabled:opacity-40">ยืนยัน</button>
        <button onClick={onCancel} className="flex-1 rounded-lg bg-white py-2 text-xs">ยกเลิก</button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-400">{text}</div>;
}

// ---------- Shops ----------
type ShopRow = {
  shop_id: string;
  name: string;
  phone: string | null;
  category: string | null;
  address: string | null;
  delivery_zone: string | null;
  logo_url: string | null;
  is_open: boolean;
  is_approved: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  deletion_requested_at: string | null;
  deletion_reason: string | null;
  created_at: string | null;
};

function ShopsTab() {
  const [rows, setRows] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EntityFilter>("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [banFor, setBanFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("shops")
      .select("shop_id,name,phone,category,address,delivery_zone,logo_url,is_open,is_approved,is_banned,banned_reason,deletion_requested_at,deletion_reason,created_at")
      .order("created_at", { ascending: false });
    setError(error?.message ?? null);
    setRows((data as ShopRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pending = rows.filter((x) => !x.is_approved && !x.is_banned);
  const active = rows.filter((x) => x.is_approved && !x.is_banned);
  const blocked = rows.filter((x) => x.is_banned);
  const visible = filter === "pending" ? pending : filter === "active" ? active : filter === "blocked" ? blocked : rows;

  async function rpc(id: string, fn: string, args: Record<string, unknown>) {
    setBusy(id); setError(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(null);
    if (error) return setError(error.message);
    setBanFor(null);
    await load();
  }

  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold">ร้านค้า</h2>
        <p className="text-xs text-gray-500">ดูทั้งร้านรออนุมัติ ร้านที่ใช้งาน และ Blacklist</p>
      </div>
      <FilterBar value={filter} onChange={setFilter} counts={{ pending: pending.length, active: active.length, blocked: blocked.length, all: rows.length }} />
      {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</p>}
      {!visible.length && <Empty text="ไม่มีร้านในหมวดนี้" />}
      {visible.map((s) => (
        <div key={s.shop_id} className="rounded-2xl border border-gray-200 p-3">
          <div className="flex gap-3">
            <img src={s.logo_url ?? ""} alt="" className="h-12 w-12 rounded-xl bg-gray-100 object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{s.name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${s.is_banned ? "bg-red-100 text-red-700" : s.is_approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {s.is_banned ? "BLACKLIST" : s.is_approved ? "อนุมัติแล้ว" : "รออนุมัติ"}
                </span>
              </div>
              <p className="text-xs text-gray-400">{s.category || "ไม่ระบุหมวด"} · {s.phone || "ไม่มีเบอร์"}</p>
            </div>
          </div>

          <button onClick={() => setExpanded(expanded === s.shop_id ? null : s.shop_id)} className="mt-2 text-xs text-orange-600">{expanded === s.shop_id ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}</button>
          {expanded === s.shop_id && (
            <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
              <p>Shop ID: {s.shop_id}</p><p>ที่อยู่: {s.address || "—"}</p><p>พื้นที่ส่ง: {s.delivery_zone || "—"}</p><p>สถานะร้าน: {s.is_open ? "เปิด" : "ปิด"}</p>
              {s.deletion_requested_at && <p className="text-orange-700">ขอปิดร้าน: {s.deletion_reason || "ไม่ระบุเหตุผล"}</p>}
              {s.is_banned && <p className="text-red-600">เหตุผล Blacklist: {s.banned_reason || "ไม่ระบุ"}</p>}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!s.is_approved && !s.is_banned && <button disabled={busy === s.shop_id} onClick={() => void rpc(s.shop_id, "fn_approve_shop", { p_shop_id: s.shop_id })} className="rounded-lg bg-green-600 px-3 py-2 text-xs text-white">✓ อนุมัติ</button>}
            {s.is_banned ? (
              <button disabled={busy === s.shop_id} onClick={() => void rpc(s.shop_id, "fn_unban_shop", { p_shop_id: s.shop_id })} className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">ปลด Blacklist</button>
            ) : banFor === s.shop_id ? null : (
              <button onClick={() => setBanFor(s.shop_id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">บล็อก / แบน</button>
            )}
          </div>
          {banFor === s.shop_id && <ReasonPrompt label="ระบุเหตุผลที่บล็อก/แบนร้าน" onSubmit={(r) => void rpc(s.shop_id, "fn_ban_shop", { p_shop_id: s.shop_id, p_reason: r })} onCancel={() => setBanFor(null)} />}
        </div>
      ))}
    </div>
  );
}

// ---------- Riders ----------
type RiderRow = {
  id: string; name: string; phone: string; rider_class: "public_win" | "general";
  is_approved: boolean; verified_at: string | null; plate_number: string | null; win_registration_no: string | null;
  is_banned: boolean; banned_reason: string | null; deletion_requested_at: string | null; deletion_reason: string | null;
};

function RidersTab() {
  const [rows, setRows] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EntityFilter>("pending");
  const [banFor, setBanFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("riders")
      .select("id,name,phone,rider_class,is_approved,verified_at,plate_number,win_registration_no,is_banned,banned_reason,deletion_requested_at,deletion_reason")
      .order("created_at", { ascending: false });
    setError(error?.message ?? null); setRows((data as RiderRow[]) ?? []); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pending = rows.filter((x) => !x.is_approved && !x.is_banned);
  const active = rows.filter((x) => x.is_approved && !x.is_banned);
  const blocked = rows.filter((x) => x.is_banned);
  const visible = filter === "pending" ? pending : filter === "active" ? active : filter === "blocked" ? blocked : rows;

  async function rpc(fn: string, args: Record<string, unknown>) { const { error } = await supabase.rpc(fn, args); if (error) setError(error.message); else { setBanFor(null); await load(); } }
  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="space-y-4">
      <div><h2 className="font-bold">วิน / Rider</h2><p className="text-xs text-gray-500">อนุมัติ ตรวจเอกสาร ระงับ และดูรายชื่อทั้งหมด</p></div>
      <FilterBar value={filter} onChange={setFilter} counts={{ pending: pending.length, active: active.length, blocked: blocked.length, all: rows.length }} />
      {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</p>}
      {!visible.length && <Empty text="ไม่มี Rider ในหมวดนี้" />}
      {visible.map((r) => (
        <div key={r.id} className="rounded-2xl border border-gray-200 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-gray-400">{r.phone} · {r.rider_class === "public_win" ? "วินป้ายเหลือง" : "Delivery"}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] ${r.is_banned ? "bg-red-100 text-red-700" : r.is_approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{r.is_banned ? "BLACKLIST" : r.is_approved ? "อนุมัติแล้ว" : "รออนุมัติ"}</span></div>
          {(r.plate_number || r.win_registration_no) && <div className="rounded-xl bg-gray-50 p-2 text-xs text-gray-600"><p>ทะเบียน: {r.plate_number || "—"}</p><p>เลขทะเบียนวิน: {r.win_registration_no || "—"}</p><p>ตรวจเอกสาร: {r.verified_at ? "แล้ว" : "ยัง"}</p></div>}
          {r.is_banned && <p className="text-xs text-red-600">เหตุผล Blacklist: {r.banned_reason || "ไม่ระบุ"}</p>}
          <div className="flex flex-wrap gap-2">
            {!r.is_approved && !r.is_banned && <button onClick={() => void rpc("fn_approve_rider", { p_rider_id: r.id })} className="rounded-lg bg-green-600 px-3 py-2 text-xs text-white">✓ อนุมัติ</button>}
            {r.rider_class === "public_win" && !r.verified_at && !r.is_banned && <button disabled={!(r.plate_number && r.win_registration_no)} onClick={() => void rpc("fn_verify_rider_document", { p_rider_id: r.id })} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40">ยืนยันเอกสาร</button>}
            {r.is_banned ? <button onClick={() => void rpc("fn_unban_rider", { p_rider_id: r.id })} className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">ปลด Blacklist</button> : banFor === r.id ? null : <button onClick={() => setBanFor(r.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">บล็อก / แบน</button>}
          </div>
          {banFor === r.id && <ReasonPrompt label="ระบุเหตุผลที่บล็อก/แบน Rider" onSubmit={(reason) => void rpc("fn_ban_rider", { p_rider_id: r.id, p_reason: reason })} onCancel={() => setBanFor(null)} />}
        </div>
      ))}
    </div>
  );
}

// ---------- Customers ----------
type CustomerRow = { id: string; name: string | null; phone: string | null; is_banned: boolean; banned_reason: string | null };

function CustomersTab() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<EntityFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banFor, setBanFor] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("customers").select("id,name,phone,is_banned,banned_reason").limit(500);
    setError(error?.message ?? null); setRows((data as CustomerRow[]) ?? []); setLoading(false);
  }, []);
  useEffect(() => { void load(); void getCurrentCustomerId().then(setSelfId); }, [load]);

  const active = rows.filter((x) => !x.is_banned);
  const blocked = rows.filter((x) => x.is_banned);
  const base = filter === "blocked" ? blocked : filter === "all" ? rows : active;
  const visible = base.filter((x) => !q.trim() || (x.name ?? "").toLowerCase().includes(q.trim().toLowerCase()) || (x.phone ?? "").includes(q.trim()));

  async function rpc(fn: string, args: Record<string, unknown>) { const { error } = await supabase.rpc(fn, args); if (error) setError(error.message); else { setBanFor(null); await load(); } }
  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="space-y-4">
      <div><h2 className="font-bold">ลูกค้า</h2><p className="text-xs text-gray-500">รายชื่อผู้ใช้งาน ค้นหา และจัดการ Blacklist</p></div>
      <FilterBar value={filter} onChange={setFilter} counts={{ active: active.length, blocked: blocked.length, all: rows.length }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือเบอร์โทร" className="w-full rounded-xl border border-gray-200 p-2.5 text-sm" />
      {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</p>}
      {!visible.length && <Empty text="ไม่พบลูกค้า" />}
      {visible.map((c) => (
        <div key={c.id} className="rounded-2xl border border-gray-200 p-3 space-y-2">
          <div className="flex justify-between gap-2"><div><p className="text-sm font-semibold">{c.name || "(ยังไม่มีชื่อ)"}</p><p className="text-xs text-gray-400">{c.phone || "ไม่มีเบอร์"}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] ${c.is_banned ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{c.is_banned ? "BLACKLIST" : "ใช้งาน"}</span></div>
          {c.is_banned && <p className="text-xs text-red-600">เหตุผล: {c.banned_reason || "ไม่ระบุ"}</p>}
          {c.id === selfId ? <p className="text-xs text-gray-400">บัญชี Admin ปัจจุบัน</p> : c.is_banned ? <button onClick={() => void rpc("fn_unban_customer", { p_customer_id: c.id })} className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">ปลด Blacklist</button> : banFor === c.id ? <ReasonPrompt label="เหตุผลที่บล็อก/แบนลูกค้า" onSubmit={(reason) => void rpc("fn_ban_customer", { p_customer_id: c.id, p_reason: reason })} onCancel={() => setBanFor(null)} /> : <button onClick={() => setBanFor(c.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">บล็อก / แบน</button>}
        </div>
      ))}
    </div>
  );
}

// ---------- Moderation / Reports / Blacklist ----------
type ReportRow = {
  report_id?: string; id?: string; reporter_customer_id?: string; subject_type?: string; subject_id?: string;
  reason?: string; details?: string; status?: string; created_at?: string;
};
type BlacklistItem = { key: string; type: string; name: string; reason: string | null };

function ModerationTab() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [shops, riders, customers, reportResult] = await Promise.all([
      supabase.from("shops").select("shop_id,name,banned_reason").eq("is_banned", true),
      supabase.from("riders").select("id,name,banned_reason").eq("is_banned", true),
      supabase.from("customers").select("id,name,banned_reason").eq("is_banned", true),
      supabase.from("moderation_reports").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setBlacklist([
      ...((shops.data as { shop_id: string; name: string; banned_reason: string | null }[] | null) ?? []).map((x) => ({ key: `shop:${x.shop_id}`, type: "ร้าน", name: x.name, reason: x.banned_reason })),
      ...((riders.data as { id: string; name: string; banned_reason: string | null }[] | null) ?? []).map((x) => ({ key: `rider:${x.id}`, type: "Rider", name: x.name, reason: x.banned_reason })),
      ...((customers.data as { id: string; name: string | null; banned_reason: string | null }[] | null) ?? []).map((x) => ({ key: `customer:${x.id}`, type: "ลูกค้า", name: x.name || "(ไม่มีชื่อ)", reason: x.banned_reason })),
    ]);
    if (reportResult.error) {
      setReportError("ยังไม่มีฐานข้อมูล Report ใน production — UI ส่วนนี้เตรียมไว้แล้ว แต่ต้องเพิ่ม moderation_reports + RLS/RPC ก่อนเปิดรับ Report จริง");
      setReports([]);
    } else {
      setReportError(null);
      setReports((reportResult.data as ReportRow[]) ?? []);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openReports = useMemo(() => reports.filter((r) => !r.status || r.status === "open" || r.status === "pending"), [reports]);
  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="space-y-6">
      <div><h2 className="font-bold">Report & Blacklist</h2><p className="text-xs text-gray-500">ศูนย์ตรวจข้อร้องเรียนและบัญชีที่ถูกระงับ</p></div>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold">🚩 Reports</p><span className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-600">เปิด {openReports.length}</span></div>
        {reportError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{reportError}</div>}
        {!reportError && !reports.length && <Empty text="ยังไม่มี Report" />}
        {reports.map((r, i) => (
          <div key={r.report_id ?? r.id ?? String(i)} className="rounded-2xl border border-red-100 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="font-semibold text-red-700">{r.subject_type || "Report"}</span><span className="text-gray-400">{r.status || "open"}</span></div>
            <p>ผู้ถูกรายงาน: {r.subject_id || "—"}</p><p>เหตุผล: {r.reason || "—"}</p>{r.details && <p className="rounded-lg bg-gray-50 p-2">รายละเอียด: {r.details}</p>}<p className="text-gray-400">ผู้รายงาน: {r.reporter_customer_id || "—"}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold">⛔ Blacklist</p><span className="rounded-full bg-gray-900 px-2 py-1 text-xs text-white">{blacklist.length}</span></div>
        {!blacklist.length && <Empty text="Blacklist ว่าง" />}
        {blacklist.map((x) => (
          <div key={x.key} className="rounded-2xl border border-gray-200 p-3">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">{x.name}</p><span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">{x.type}</span></div>
            <p className="mt-1 text-xs text-red-600">เหตุผล: {x.reason || "ไม่ระบุ"}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
