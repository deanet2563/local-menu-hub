// ============================================================
// MyTree — Food Hub sponsor slot.
// No ads backend exists yet; content is hardcoded per-instance so
// this stays a plain display component that's easy to point at real
// sponsor data later (props in, no fetching here).
// ============================================================

type Props = {
  label: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
};

export function SponsorCard({ label, title, subtitle, ctaLabel = "ดูเพิ่มเติม" }: Props) {
  return (
    <aside className="relative overflow-hidden rounded-3xl bg-[#FFF0E4] p-4 ring-1 ring-[#FFD0AD]">
      <div className="absolute -bottom-8 -right-7 h-24 w-24 rotate-12 rounded-[28px] bg-[#FF7417]/10" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF7417] text-white"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><path d="M4 13V8l13-4v13L4 13Z" /><path d="M17 8h3M17 13h3M7 14l1 6h4l-2-5" /></svg></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#BB4B00]">{label}</p><p className="mt-0.5 truncate text-sm font-extrabold text-[#3E332A]">{title}</p><p className="mt-0.5 truncate text-xs text-[#78685A]">{subtitle}</p></div>
        <span className="shrink-0 rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#BB4B00] shadow-sm">{ctaLabel}</span>
      </div>
    </aside>
  );
}
