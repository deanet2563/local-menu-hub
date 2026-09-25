export type RiderDashboardDeliveryRow = {
  delivery_fee: number | string | null;
  delivery_distance_km: number | string | null;
  delivered_at: string | null;
};

export type RiderDashboardSummary = {
  earnings: number;
  completedJobs: number;
  distanceKm: number;
};

export function summarizeTodayRiderWork(
  rows: RiderDashboardDeliveryRow[],
  todayKey?: string,
): RiderDashboardSummary;
