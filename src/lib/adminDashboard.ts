import { getAdminAccessContext, hasAdminPermission } from "@/lib/adminAccess";
import { supabase } from "@/lib/supabase";

export type DashboardMetric = {
  value: number | null;
  available: boolean;
};

export type DashboardTrendPoint = {
  date: string;
  members: number | null;
  shops: number | null;
  orders: number | null;
};

export type AdminDashboardSnapshot = {
  generated_at: string;
  timezone: string;
  metrics: Record<string, DashboardMetric>;
  trends: DashboardTrendPoint[];
  alerts: Record<string, DashboardMetric>;
};

function parseMetric(value: unknown): DashboardMetric {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value: null, available: false };
  }
  const row = value as Record<string, unknown>;
  return {
    value: typeof row.value === "number" ? row.value : null,
    available: row.available === true,
  };
}

function parseSnapshot(value: unknown): AdminDashboardSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Dashboard response is invalid");
  }
  const raw = value as Record<string, unknown>;
  const rawMetrics = raw.metrics && typeof raw.metrics === "object" && !Array.isArray(raw.metrics)
    ? raw.metrics as Record<string, unknown>
    : {};
  const rawAlerts = raw.alerts && typeof raw.alerts === "object" && !Array.isArray(raw.alerts)
    ? raw.alerts as Record<string, unknown>
    : {};
  const trends = Array.isArray(raw.trends)
    ? raw.trends.flatMap((point): DashboardTrendPoint[] => {
        if (!point || typeof point !== "object" || Array.isArray(point)) return [];
        const item = point as Record<string, unknown>;
        if (typeof item.date !== "string") return [];
        return [{
          date: item.date,
          members: typeof item.members === "number" ? item.members : null,
          shops: typeof item.shops === "number" ? item.shops : null,
          orders: typeof item.orders === "number" ? item.orders : null,
        }];
      })
    : [];

  return {
    generated_at: typeof raw.generated_at === "string" ? raw.generated_at : new Date().toISOString(),
    timezone: typeof raw.timezone === "string" ? raw.timezone : "Asia/Bangkok",
    metrics: Object.fromEntries(Object.entries(rawMetrics).map(([key, metric]) => [key, parseMetric(metric)])),
    trends,
    alerts: Object.fromEntries(Object.entries(rawAlerts).map(([key, metric]) => [key, parseMetric(metric)])),
  };
}

export async function getAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const access = await getAdminAccessContext();
  if (!access.is_active || !access.role_key) throw new Error("Admin access is not active");
  const canReadDashboard = ["analytics.read", "members.read", "shops.read", "riders.read", "orders.read", "finance.read"]
    .some((permission) => hasAdminPermission(access, permission));
  if (!canReadDashboard) throw new Error("No dashboard permission");

  const { data, error } = await supabase.rpc("fn_head_office_dashboard");
  if (error) throw error;
  return parseSnapshot(data);
}
