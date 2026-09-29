import { Link } from "@tanstack/react-router";

export function EmergencyReportNavAction({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/community/report"
      aria-label="แจ้งเหตุหรือขอความช่วยเหลือ"
      className={compact
        ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#b42318] px-4 py-2 text-sm font-black text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b42318]"
        : "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#b42318] px-4 py-3 text-base font-black text-white shadow-[0_8px_24px_rgba(180,35,24,.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b42318]"}
    >
      <span aria-hidden="true">⚠️</span>
      <span>แจ้งเหตุ / ขอความช่วยเหลือ</span>
    </Link>
  );
}
