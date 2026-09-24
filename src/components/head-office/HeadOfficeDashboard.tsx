import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdminDashboardSnapshot,
  type AdminDashboardSnapshot,
  type DashboardMetric,
} from "@/lib/adminDashboard";

type MetricCard = {
  key: string;
  label: string;
  route?: "members" | "shops" | "riders" | "orders";
  format?: "number" | "currency";
};

const METRIC_CARDS: MetricCard[] = [
  { key: "total_members", label: "สมาชิกทั้งหมด", route: "members" },
  { key: "active_members", label: "สมาชิก Active", route: "members" },
  { key: "total_shops", label: "ร้านทั้งหมด", route: "shops" },
  { key: "active_shops", label: "ร้าน Active", route: "shops" },
  { key: "total_riders", label: "ไรเดอร์ทั้งหมด", route: "riders" },
  { key: "riders_online", label: "ไรเดอร์ออนไลน์", route: "riders" },
  { key: "orders_today", label: "ออเดอร์วันนี้", route: "orders" },
  { key: "orders_7_days", label: "ออเดอร์ 7 วัน", route: "orders" },
  { key: "paid_gmv_7_days", label: "Paid GMV 7 วัน", route: "orders", format: "currency" },
  { key: "delivery_jobs", label: "งานจัดส่งทั้งหมด", route: "orders" },
  { key: "total_communities", label: "ชุมชนทั้งหมด" },
  { key: "marketplace_listings", label: "Marketplace Listings" },
];

const ALERTS = [
  { key: "pending_shop_approvals", label: "ร้านรออนุมัติ", route: "shops" as const },
  { key: "pending_rider_approvals", label: "ไรเดอร์รออนุมัติ", route: "riders" as const },
  { key: "unresolved_reports", label: "รายงานรอตรวจสอบ", route: "moderation" as const },
  { key: "abnormal_orders", label: "ออเดอร์ค้างเกิน 24 ชม.", route: "orders" as const },
  { key: "failed_deliveries", label: "การจัดส่งล้มเหลว", route: "orders" as const },
];

function formatMetric(metric: DashboardMetric | undefined, format: MetricCard["format"] = "number") {
  if (!metric?.available || metric.value === null) return "—";
  return format === "currency"
    ? new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(metric.value)
    : new Intl.NumberFormat("th-TH").format(metric.value);
}

export function HeadOfficeDashboard() {
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await getAdminDashboardSnapshot());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ไม่สามารถโหลดข้อมูล Dashboard ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const maxTrend = useMemo(() => Math.max(1, ...(snapshot?.trends.flatMap((point) =>
    [point.members, point.shops, point.orders].filter((value): value is number => value !== null)) ?? [1])), [snapshot]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError message={error} onRetry={() => void load()} />;
  if (!snapshot) return <DashboardError message="ไม่พบข้อมูล Dashboard" onRetry={() => void load()} />;

  const availableCount = METRIC_CARDS.filter((item) => snapshot.metrics[item.key]?.available).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">ข้อมูลจริงจาก MyTree Platform</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Executive Overview</h2>
          <p className="mt-2 text-sm text-gray-500">แสดงเฉพาะข้อมูลที่มี source และสิทธิ์เข้าถึงจริง</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-gray-400">อัปเดตล่าสุด</p>
          <p className="mt-1 text-sm font-medium text-gray-700">{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: snapshot.timezone }).format(new Date(snapshot.generated_at))}</p>
          <button type="button" onClick={() => void load()} className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800">รีเฟรชข้อมูล</button>
        </div>
      </section>

      {availableCount === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <h3 className="font-semibold">ไม่มี KPI ที่บัญชีนี้ได้รับอนุญาตให้ดู</h3>
          <p className="mt-2 text-sm text-gray-500">Dashboard จะไม่เปิดเผยข้อมูลจาก module ที่ไม่มี permission</p>
        </section>
      ) : (
        <section aria-label="Platform KPIs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {METRIC_CARDS.map((item) => <KpiCard key={item.key} item={item} metric={snapshot.metrics[item.key]} />)}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">แนวโน้ม 7 วัน</h3>
          <p className="mt-1 text-sm text-gray-500">สมาชิกใหม่ · ร้านใหม่ · ออเดอร์ใหม่รายวัน</p>
          {snapshot.trends.length === 0 ? <Empty message="ยังไม่มีข้อมูลย้อนหลังที่ได้รับอนุญาต" /> : (
            <div className="mt-6 space-y-4">
              {snapshot.trends.map((point) => (
                <div key={point.date} className="grid grid-cols-[5rem_1fr] items-center gap-3">
                  <span className="text-xs text-gray-500">{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: snapshot.timezone }).format(new Date(`${point.date}T00:00:00+07:00`))}</span>
                  <div className="space-y-1.5">
                    <TrendBar label="สมาชิก" value={point.members} max={maxTrend} color="bg-sky-500" />
                    <TrendBar label="ร้าน" value={point.shops} max={maxTrend} color="bg-emerald-500" />
                    <TrendBar label="ออเดอร์" value={point.orders} max={maxTrend} color="bg-amber-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Operational Alerts</h3>
          <p className="mt-1 text-sm text-gray-500">เฉพาะรายการที่มี source จริงและอยู่ในสิทธิ์</p>
          <div className="mt-5 divide-y divide-gray-100">
            {ALERTS.map((item) => {
              const metric = snapshot.alerts[item.key];
              return (
                <Link key={item.key} to="/head-office/$section" params={{ section: item.route }} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-emerald-700">
                  <span className="text-sm">{item.label}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${metric?.available && (metric.value ?? 0) > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"}`}>
                    {formatMetric(metric)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ item, metric }: { item: MetricCard; metric?: DashboardMetric }) {
  const content = (
    <>
      <p className="text-sm text-gray-500">{item.label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{formatMetric(metric, item.format)}</p>
      {!metric?.available && <p className="mt-2 text-xs text-gray-400">ไม่มี source หรือไม่มีสิทธิ์</p>}
    </>
  );
  const className = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300";
  return item.route && metric?.available ? <Link to="/head-office/$section" params={{ section: item.route }} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function TrendBar({ label, value, max, color }: { label: string; value: number | null; max: number; color: string }) {
  if (value === null) return <div className="text-[11px] text-gray-300">{label}: ไม่มีสิทธิ์</div>;
  return <div className="flex items-center gap-2"><span className="w-12 text-[11px] text-gray-500">{label}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%` }} /></div><span className="w-6 text-right text-[11px] font-medium">{value}</span></div>;
}

function DashboardSkeleton() { return <div className="space-y-4" role="status" aria-live="polite"><p className="text-sm text-gray-500">กำลังโหลดข้อมูล Dashboard...</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-gray-200" />)}</div></div>; }
function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) { return <section className="rounded-3xl border border-red-200 bg-red-50 p-6"><h2 className="font-semibold text-red-900">โหลด Dashboard ไม่สำเร็จ</h2><p className="mt-2 text-sm text-red-700">{message}</p><button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-red-900 px-4 py-2 text-sm font-medium text-white">ลองอีกครั้ง</button></section>; }
function Empty({ message }: { message: string }) { return <div className="mt-6 rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">{message}</div>; }
