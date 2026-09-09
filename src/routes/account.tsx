import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentCustomerId, initLiff, supabase } from "@/lib/supabase";
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
        await initLiff();
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

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  if (!id)
    return (
      <div className="p-6 text-center text-sm">
        🔒 กรุณาเปิดหน้านี้ผ่าน LINE เพื่อเข้าสู่ระบบ
        {e2eDiagnosticsEnabled() && <AccountAuthDiagnostics events={authTimeline} />}
      </div>
    );

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-bold">ข้อมูลของฉัน</h1>
        <p className="text-sm text-gray-500">My Account</p>
      </div>
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

      <form onSubmit={save} className="space-y-4 rounded-xl border border-gray-200 p-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">ชื่อ</span>
          <input className="w-full rounded-lg border p-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">เบอร์โทร</span>
          <input className="w-full rounded-lg border p-2 text-sm" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">ที่อยู่จัดส่งประจำ</span>
          <textarea className="w-full rounded-lg border p-2 text-sm" rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>

        <button disabled={saving} className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>

        {message && <p className="text-sm text-gray-600">{message}</p>}
      </form>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/orders" className="rounded-lg bg-gray-100 px-3 py-2 text-center text-sm">ประวัติออเดอร์</Link>
        <Link to="/" className="rounded-lg bg-gray-100 px-3 py-2 text-center text-sm">สั่งอาหาร</Link>
      </div>
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
