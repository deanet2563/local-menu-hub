export type BusinessHours = Record<string, { open?: string; close?: string; closed?: boolean }>;

export type ShopAvailability = {
  canOrder: boolean;
  state: "open" | "schedule_closed" | "manual_closed";
  label: string;
  detail: string | null;
  nextOpeningAt: string | null;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  sun: "อาทิตย์", mon: "จันทร์", tue: "อังคาร", wed: "พุธ",
  thu: "พฤหัสบดี", fri: "ศุกร์", sat: "เสาร์",
};

function parseMinutes(value?: string): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function bangkokParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday").toLowerCase().slice(0, 3) as (typeof DAY_KEYS)[number];
  const dayIndex = DAY_KEYS.indexOf(weekday);
  return {
    dayIndex: dayIndex >= 0 ? dayIndex : 0,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    year: Number(get("year")), month: Number(get("month")), day: Number(get("day")),
  };
}

function bangkokLocalToIso(year: number, month: number, day: number, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // Asia/Bangkok is UTC+7 year-round.
  return new Date(Date.UTC(year, month - 1, day, h - 7, m, 0, 0)).toISOString();
}

function addBangkokDays(parts: ReturnType<typeof bangkokParts>, offset: number) {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isInside(hours: BusinessHours | null | undefined, dayIndex: number, minutes: number): boolean {
  const today = hours?.[DAY_KEYS[dayIndex]!];
  if (today && !today.closed) {
    const open = parseMinutes(today.open);
    const close = parseMinutes(today.close);
    if (open !== null && close !== null) {
      if (open === close) return true;
      if (close > open && minutes >= open && minutes < close) return true;
      if (close < open && minutes >= open) return true;
    }
  }
  const prevIndex = (dayIndex + 6) % 7;
  const prev = hours?.[DAY_KEYS[prevIndex]!];
  if (prev && !prev.closed) {
    const open = parseMinutes(prev.open);
    const close = parseMinutes(prev.close);
    if (open !== null && close !== null && close < open && minutes < close) return true;
  }
  return false;
}

function nextOpening(hours: BusinessHours | null | undefined, now = new Date()): { label: string; iso: string } | null {
  const clock = bangkokParts(now);
  for (let offset = 0; offset < 7; offset += 1) {
    const idx = (clock.dayIndex + offset) % 7;
    const h = hours?.[DAY_KEYS[idx]!];
    if (!h || h.closed) continue;
    const open = parseMinutes(h.open);
    const close = parseMinutes(h.close);
    if (open === null || close === null) continue;

    if (offset === 0) {
      if (open === close) return null;
      const canOpenLater = close > open ? clock.minutes < open : clock.minutes >= close && clock.minutes < open;
      if (!canOpenLater) continue;
    }

    const date = addBangkokDays(clock, offset);
    const iso = bangkokLocalToIso(date.year, date.month, date.day, open);
    const label = offset === 0 ? `เปิดวันนี้ ${h.open}` : offset === 1 ? `เปิดพรุ่งนี้ ${h.open}` : `เปิด${DAY_LABELS[DAY_KEYS[idx]!]} ${h.open}`;
    return { label, iso };
  }
  return null;
}

export function getShopAvailability(
  isOpenFlag: boolean | null | undefined,
  businessHours: BusinessHours | null | undefined,
  now = new Date(),
): ShopAvailability {
  if (!isOpenFlag) {
    return { canOrder: false, state: "manual_closed", label: "ปิดชั่วคราว", detail: "ร้านปิดรับออเดอร์ชั่วคราว", nextOpeningAt: null };
  }
  const { dayIndex, minutes } = bangkokParts(now);
  if (isInside(businessHours, dayIndex, minutes)) {
    return { canOrder: true, state: "open", label: "เปิดอยู่", detail: null, nextOpeningAt: null };
  }
  const next = nextOpening(businessHours, now);
  return {
    canOrder: false,
    state: "schedule_closed",
    label: "ปิดตามเวลาทำการ",
    detail: next?.label ?? null,
    nextOpeningAt: next?.iso ?? null,
  };
}
