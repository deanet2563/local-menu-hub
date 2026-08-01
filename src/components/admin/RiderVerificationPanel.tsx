// ============================================================
// MyTree — Admin Rider Verification Panel
// Lists riders needing action and calls the admin-only RPCs:
//   fn_approve_rider / fn_verify_rider_document / fn_revoke_rider
//
// NOTE(auth): RPCs are gated by fn_is_platform_admin() which reads
// customer_id from the JWT. They only succeed when called by an
// authenticated admin session. Until LINE auth is wired, this screen
// renders but the calls will be rejected ("not authorized"). The
// founder dev admin customer_id is: c8ddd7df-4772-4918-b1cb-1dad624a11bd
// ============================================================

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type PendingRider = {
  id: string;
  name: string;
  phone: string;
  rider_class: "public_win" | "general";
  is_approved: boolean;
  verified_at: string | null;
  offers_passenger: boolean;
  plate_number: string | null;
  win_registration_no: string | null;
  win_zone: string | null;
};

const COLS =
  "id, name, phone, rider_class, is_approved, verified_at, offers_passenger, plate_number, win_registration_no, win_zone";

export function RiderVerificationPanel() {
  const [riders, setRiders] = useState<PendingRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    // riders needing attention: not yet approved, OR public_win with docs not yet verified
    const { data, error } = await supabase
      .from("riders")
      .select(COLS)
      .or("is_approved.eq.false,and(rider_class.eq.public_win,verified_at.is.null)")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    setRiders((data as PendingRider[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function callRpc(fn: string, riderId: string, extra?: Record<string, unknown>) {
    setBusyId(riderId);
    setError(null);
    const { error } = await supabase.rpc(fn, { p_rider_id: riderId, ...(extra ?? {}) });
    setBusyId(null);
    if (error) {
      setError(`${fn}: ${error.message}`);
      return;
    }
    await load();
  }

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold">🛡️ ตรวจสอบ/อนุมัติวิน</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {riders.length === 0 && (
        <p className="text-sm text-gray-400">ไม่มีวินที่รอดำเนินการ</p>
      )}

      <div className="space-y-3">
        {riders.map((r) => {
          const isWin = r.rider_class === "public_win";
          const hasDocs = !!(r.plate_number && r.win_registration_no);
          const busy = busyId === r.id;
          return (
            <div key={r.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.phone}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${isWin ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                  {isWin ? "วินป้ายเหลือง" : "ทั่วไป"}
                </span>
              </div>

              {isWin && (
                <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600 space-y-0.5">
                  <p>ทะเบียน: {r.plate_number ?? "— ยังไม่กรอก —"}</p>
                  <p>เลขวิน: {r.win_registration_no ?? "— ยังไม่กรอก —"}</p>
                  {r.win_zone && <p>สังกัด: {r.win_zone}</p>}
                  <p>เอกสารยืนยัน: {r.verified_at ? "✅ ยืนยันแล้ว" : "⏳ ยังไม่ยืนยัน"}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {!r.is_approved && (
                  <button
                    onClick={() => callRpc("fn_approve_rider", r.id)}
                    disabled={busy}
                    className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    อนุมัติเข้า directory
                  </button>
                )}
                {isWin && !r.verified_at && (
                  <button
                    onClick={() => callRpc("fn_verify_rider_document", r.id)}
                    disabled={busy || !hasDocs}
                    title={hasDocs ? "" : "วินยังไม่กรอกเอกสารครบ"}
                    className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    ยืนยันเอกสารป้ายเหลือง
                  </button>
                )}
                <button
                  onClick={() => callRpc("fn_revoke_rider", r.id)}
                  disabled={busy}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-50"
                >
                  ระงับ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
