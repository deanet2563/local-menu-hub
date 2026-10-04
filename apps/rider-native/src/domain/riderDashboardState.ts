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

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function numeric(value: number | string | null) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

export function summarizeTodayRiderWork(
  rows: RiderDashboardDeliveryRow[],
  todayKey = localDateKey(new Date()),
): RiderDashboardSummary {
  const deliveredToday = (rows ?? []).filter((row) => {
    if (!row?.delivered_at) return false;
    return localDateKey(new Date(row.delivered_at)) === todayKey;
  });

  const earnings = deliveredToday.reduce((sum, row) => sum + numeric(row.delivery_fee), 0);
  const distanceKm = deliveredToday.reduce((sum, row) => sum + numeric(row.delivery_distance_km), 0);

  return {
    earnings: Math.round(earnings * 100) / 100,
    completedJobs: deliveredToday.length,
    distanceKm: Math.round(distanceKm * 10) / 10,
  };
}
