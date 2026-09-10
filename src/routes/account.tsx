import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentCustomerId, supabase } from "@/lib/supabase";
import { e2eDiagnosticsEnabled } from "@/lib/e2eDiagnostics";
import type { CustomerProfileTimelineEvent } from "@/lib/customerProfileDiagnostics";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const [id, setId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [authTimeline, setAuthTimeline] = useState<CustomerProfileTimelineEvent[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const cid = await getCurrentCustomerId({
          onTimelineStep: (event) => {
            if (!e2eDiagnosticsEnabled()) return;
            setAuthTimeline((current) => [...current, event].slice(-30));
          },
        });
        if (e2eDiagnosticsEnabled()) {
          const guardEvent: CustomerProfileTimelineEvent = {
            step: "account_auth_guard_result",
            at: new Date().toISOString(),
            elapsedMs: 0,
            detail: cid ? "ready" : "missing",
          };
          setAuthTimeline((current) => [...current, {
            ...guardEvent,
          }].slice(-30));
        }
        if (!cid) return;
        setId(cid);

        const [{ data: customer, error }, { data: admin }] = await Promise.all([
          supabase
            .from("customers")
            .select("name,phone,default_address")
            .eq("id", cid)
            .single(),
          supabase
            .from("platform_admins")
            .select("customer_id")
            .eq("customer_id", cid)
            .maybeSingle(),
        ]);

        if (error) throw error;
        setName(customer?.name ?? "");
        setPhone(customer?.phone ?? "");
        setAddress(customer?.default_address ?? "");
        setIsAdmin(!!admin);
      } catch {
        setMessage("โหลดข้อมูลไม่สำเร็จ กรุณาเปิดผ่าน LINE แล้วลองใหม่");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("customers")
      .update({
        name: name.trim() || null,
        phone: phone.trim() || null,
        default_address: address.trim() || null,
      })
      .eq("id", id);

    setSaving(false);
    setMessage(error ? `บันทึกไม่สำเร็จ: ${error.message}` : "บันทึกข้อมูลเรียบร้อยแล้ว");
  }

  if (loading) {
    return (
      <AccountShell>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          กำลังโหลดข้อมูลบัญชี...
        </div>
      </AccountShell>
    );
  }

  if (!id)
    return (
      <div className="customer-bottom-safe-padding min-h-screen bg-[#f7f7f3] px-4 py-6 text-slate-900">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm shadow-sm">
          กรุณาเปิดหน้านี้ผ่าน LINE เพื่อเข้าสู่ระบบ
        </div>
        {e2eDiagnosticsEnabled() && <AccountAuthDiagnostics events={authTimeline} />}
      </div>
    );

  return (
    <AccountShell>
      {e2eDiagnosticsEnabled() && <AccountAuthDiagnostics events={authTimeline} />}

      {isAdmin && (
        <Link
          to="/sweet/admin"
          className="block rounded-2xl border border-orange-200 bg-orange-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-orange-800">🛡️ Admin Dashboard</p>
              <p className="mt-0.5 text-xs text-orange-700">อนุมัติร้าน/วิน จัดการลูกค้า รายงาน และ Blacklist</p>
            </div>
            <span className="text-xl text-orange-600">›</span>
          </div>
        </Link>
      )}

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-700">ชื่อ</span>
          <input className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-orange-400" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-700">เบอร์โทร</span>
          <input className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-orange-400" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-700">ที่อยู่จัดส่งประจำ</span>
          <textarea className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-orange-400" rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>

        <button disabled={saving} className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>

        {message && <p className="text-sm text-slate-600">{message}</p>}
      </form>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/orders" className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold shadow-sm">ประวัติออเดอร์</Link>
        <Link to="/food" className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold shadow-sm">สั่งอาหาร</Link>
      </div>
    </AccountShell>
  );
}

function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="customer-bottom-safe-padding min-h-screen bg-[#f7f7f3] text-slate-900">
      <header className="mx-auto max-w-md px-4 pb-3 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-orange-600">MyTree</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">บัญชีของฉัน</h1>
        <p className="mt-1 text-sm text-slate-500">จัดการข้อมูลสำหรับสั่งอาหารและติดตามออเดอร์</p>
      </header>
      <main className="mx-auto max-w-md space-y-4 px-4">
        {children}
      </main>
    </div>
  );
}

function AccountAuthDiagnostics({ events }: { events: CustomerProfileTimelineEvent[] }) {
  return (
    <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left font-mono text-[11px] text-slate-800">
      <p className="font-semibold">account_auth_diagnostics</p>
      <pre className="mt-2 whitespace-pre-wrap break-all">
        {events.map((event) => `${event.elapsedMs}ms ${event.step}${event.detail ? `: ${event.detail}` : ""}`).join("\n") || "no_events"}
      </pre>
    </section>
  );
}
