import { useEffect, useState, useCallback } from "react";
import { supabase, getCurrentCustomerId } from "@/lib/supabase";

// ============================================================
// MyTree — Unified Admin Console (supersedes the old RiderVerificationPanel)
// 3 tabs: ร้านค้า / วิน / ลูกค้า — approve, ban/unban, and handle
// self-service deletion requests for all three actor groups.
// ============================================================

type Tab = "shops" | "riders" | "customers";

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("shops");
  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="p-4 pb-0">
        <h1 className="text-lg font-bold">🛡️ ศูนย์จัดการแอดมิน</h1>
      </div>
      <div className="flex gap-2 px-4 pt-3 sticky top-0 bg-white z-10">
        {([
          ["shops", "🏪 ร้านค้า"],
          ["riders", "🛵 วิน"],
          ["customers", "👤 ลูกค้า"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === key ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "shops" && <ShopsTab />}
        {tab === "riders" && <RidersTab />}
        {tab === "customers" && <CustomersTab />}
      </div>
    </div>
  );
}

// ============================================================
// Reusable bits
// ============================================================
function ReasonPrompt({
  label, onSubmit, onCancel,
}: { label: string; onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-2 space-y-2 mt-2">
      <textarea
        className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        placeholder={label}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <button
          onClick={() => reason.trim() && onSubmit(reason.trim())}
          className="flex-1 rounded-lg bg-red-500 text-white text-xs py-1.5"
        >
          ยืนยัน
        </button>
        <button onClick={onCancel} className="flex-1 rounded-lg bg-gray-100 text-xs py-1.5">ยกเลิก</button>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{title} ({count})</p>
      {children}
    </div>
  );
}

// ============================================================
// SHOPS TAB
// ============================================================
type ShopRow = {
  shop_id: string; name: string; phone: string | null; category: string | null;
  is_approved: boolean; is_banned: boolean; banned_reason: string | null;
  deletion_requested_at: string | null; deletion_reason: string | null;
};

function ShopsTab() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [banPromptFor, setBanPromptFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("shops")
      .select("shop_id,name,phone,category,is_approved,is_banned,banned_reason,deletion_requested_at,deletion_reason")
      .order("created_at", { ascending: false });
    setShops((data as ShopRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pending = shops.filter((s) => !s.is_approved && !s.is_banned && !s.deletion_requested_at);
  const deletionRequests = shops.filter((s) => s.deletion_requested_at && !s.is_banned);
  const banned = shops.filter((s) => s.is_banned);

  async function approve(shopId: string) {
    await supabase.rpc("fn_approve_shop", { p_shop_id: shopId });
    load();
  }
  async function ban(shopId: string, reason: string) {
    await supabase.rpc("fn_ban_shop", { p_shop_id: shopId, p_reason: reason });
    setBanPromptFor(null);
    load();
  }
  async function unban(shopId: string) {
    await supabase.rpc("fn_unban_shop", { p_shop_id: shopId });
    load();
  }
  async function rejectDeletion(shopId: string) {
    await supabase.rpc("fn_reject_shop_deletion", { p_shop_id: shopId });
    load();
  }

  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;
  if (!pending.length && !deletionRequests.length && !banned.length)
    return <p className="text-sm text-gray-400">ไม่มีร้านค้าที่รอดำเนินการ</p>;

  return (
    <div className="space-y-6">
      <Section title="รออนุมัติ" count={pending.length}>
        {pending.map((s) => (
          <div key={s.shop_id} className="rounded-lg border border-gray-200 p-3 space-y-1">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="text-xs text-gray-400">{s.category} · {s.phone}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => approve(s.shop_id)} className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5">อนุมัติ</button>
              {banPromptFor === s.shop_id ? null : (
                <button onClick={() => setBanPromptFor(s.shop_id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">แบน</button>
              )}
            </div>
            {banPromptFor === s.shop_id && (
              <ReasonPrompt label="เหตุผลที่แบน" onSubmit={(r) => ban(s.shop_id, r)} onCancel={() => setBanPromptFor(null)} />
            )}
          </div>
        ))}
      </Section>

      <Section title="คำขอปิด/ลบร้าน" count={deletionRequests.length}>
        {deletionRequests.map((s) => (
          <div key={s.shop_id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="text-xs text-gray-600">เหตุผล: {s.deletion_reason}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => ban(s.shop_id, s.deletion_reason ?? "ร้านขอปิดกิจการ")} className="rounded-lg bg-red-500 text-white text-xs px-3 py-1.5">อนุมัติปิดร้าน</button>
              <button onClick={() => rejectDeletion(s.shop_id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">ปฏิเสธคำขอ</button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="ถูกระงับ" count={banned.length}>
        {banned.map((s) => (
          <div key={s.shop_id} className="rounded-lg border border-red-200 p-3 space-y-1">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="text-xs text-red-600">เหตุผล: {s.banned_reason}</p>
            <button onClick={() => unban(s.shop_id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5 mt-1">ปลดแบน</button>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ============================================================
// RIDERS TAB
// ============================================================
type RiderRow = {
  id: string; name: string; phone: string; rider_class: "public_win" | "general";
  is_approved: boolean; verified_at: string | null; offers_passenger: boolean;
  plate_number: string | null; win_registration_no: string | null;
  is_banned: boolean; banned_reason: string | null;
  deletion_requested_at: string | null; deletion_reason: string | null;
};

const RIDER_COLS =
  "id,name,phone,rider_class,is_approved,verified_at,offers_passenger,plate_number,win_registration_no,is_banned,banned_reason,deletion_requested_at,deletion_reason";

function RidersTab() {
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [banPromptFor, setBanPromptFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("riders").select(RIDER_COLS).order("created_at", { ascending: false });
    setRiders((data as RiderRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pending = riders.filter((r) => (!r.is_approved || (r.rider_class === "public_win" && !r.verified_at && r.plate_number)) && !r.is_banned && !r.deletion_requested_at);
  const deletionRequests = riders.filter((r) => r.deletion_requested_at && !r.is_banned);
  const banned = riders.filter((r) => r.is_banned);

  async function approve(id: string) { await supabase.rpc("fn_approve_rider", { p_rider_id: id }); load(); }
  async function verify(id: string) { await supabase.rpc("fn_verify_rider_document", { p_rider_id: id }); load(); }
  async function ban(id: string, reason: string) { await supabase.rpc("fn_ban_rider", { p_rider_id: id, p_reason: reason }); setBanPromptFor(null); load(); }
  async function unban(id: string) { await supabase.rpc("fn_unban_rider", { p_rider_id: id }); load(); }
  async function rejectDeletion(id: string) { await supabase.rpc("fn_reject_rider_deletion", { p_rider_id: id }); load(); }

  if (loading) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;
  if (!pending.length && !deletionRequests.length && !banned.length)
    return <p className="text-sm text-gray-400">ไม่มีวินที่รอดำเนินการ</p>;

  return (
    <div className="space-y-6">
      <Section title="รออนุมัติ / รอตรวจเอกสาร" count={pending.length}>
        {pending.map((r) => {
          const isWin = r.rider_class === "public_win";
          const hasDocs = !!(r.plate_number && r.win_registration_no);
          return (
            <div key={r.id} className="rounded-lg border border-gray-200 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{r.name}</p>
                <span className={`text-[11px] rounded-full px-2 py-0.5 ${isWin ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                  {isWin ? "วินป้ายเหลือง" : "ทั่วไป"}
                </span>
              </div>
              <p className="text-xs text-gray-400">{r.phone}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {!r.is_approved && (
                  <button onClick={() => approve(r.id)} className="rounded-lg bg-green-500 text-white text-xs px-3 py-1.5">อนุมัติ</button>
                )}
                {isWin && !r.verified_at && (
                  <button onClick={() => verify(r.id)} disabled={!hasDocs} className="rounded-lg bg-blue-500 text-white text-xs px-3 py-1.5 disabled:opacity-50">ยืนยันเอกสาร</button>
                )}
                {banPromptFor !== r.id && (
                  <button onClick={() => setBanPromptFor(r.id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">แบน</button>
                )}
              </div>
              {banPromptFor === r.id && (
                <ReasonPrompt label="เหตุผลที่แบน" onSubmit={(reason) => ban(r.id, reason)} onCancel={() => setBanPromptFor(null)} />
              )}
            </div>
          );
        })}
      </Section>

      <Section title="คำขอลบบัญชี" count={deletionRequests.length}>
        {deletionRequests.map((r) => (
          <div key={r.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1">
            <p className="text-sm font-medium">{r.name}</p>
            <p className="text-xs text-gray-600">เหตุผล: {r.deletion_reason}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => ban(r.id, r.deletion_reason ?? "วินขอลบบัญชี")} className="rounded-lg bg-red-500 text-white text-xs px-3 py-1.5">อนุมัติลบ</button>
              <button onClick={() => rejectDeletion(r.id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">ปฏิเสธคำขอ</button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="ถูกระงับ" count={banned.length}>
        {banned.map((r) => (
          <div key={r.id} className="rounded-lg border border-red-200 p-3 space-y-1">
            <p className="text-sm font-medium">{r.name}</p>
            <p className="text-xs text-red-600">เหตุผล: {r.banned_reason}</p>
            <button onClick={() => unban(r.id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5 mt-1">ปลดแบน</button>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ============================================================
// CUSTOMERS TAB — search-based (no admin-facing bulk listing)
// ============================================================
type CustomerRow = { id: string; name: string | null; phone: string | null; is_banned: boolean; banned_reason: string | null };

function CustomersTab() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [banPromptFor, setBanPromptFor] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentCustomerId().then(setSelfId);
  }, []);

  async function search() {
    if (!q.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("customers")
      .select("id,name,phone,is_banned,banned_reason")
      .or(`name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`)
      .limit(20);
    setResults((data as CustomerRow[]) ?? []);
    setSearching(false);
  }

  async function ban(id: string, reason: string) {
    await supabase.rpc("fn_ban_customer", { p_customer_id: id, p_reason: reason });
    setBanPromptFor(null);
    search();
  }
  async function unban(id: string) {
    await supabase.rpc("fn_unban_customer", { p_customer_id: id });
    search();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-gray-200 p-2 text-sm"
          placeholder="ค้นหาชื่อหรือเบอร์โทร"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} disabled={searching} className="rounded-lg bg-orange-500 text-white px-4 text-sm">ค้นหา</button>
      </div>

      {results.map((c) => (
        <div key={c.id} className="rounded-lg border border-gray-200 p-3 space-y-1">
          <p className="text-sm font-medium">{c.name || "(ไม่มีชื่อ)"}</p>
          <p className="text-xs text-gray-400">{c.phone}</p>
          {c.is_banned ? (
            <>
              <p className="text-xs text-red-600">ถูกแบน — {c.banned_reason}</p>
              <button onClick={() => unban(c.id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">ปลดแบน</button>
            </>
          ) : c.id === selfId ? (
            <p className="text-xs text-gray-400">(นี่คือบัญชีของคุณ)</p>
          ) : banPromptFor === c.id ? (
            <ReasonPrompt label="เหตุผลที่แบน" onSubmit={(reason) => ban(c.id, reason)} onCancel={() => setBanPromptFor(null)} />
          ) : (
            <button onClick={() => setBanPromptFor(c.id)} className="rounded-lg bg-gray-100 text-xs px-3 py-1.5">แบน</button>
          )}
        </div>
      ))}
      {q && results.length === 0 && !searching && <p className="text-sm text-gray-400">ไม่พบผลลัพธ์</p>}
    </div>
  );
}
