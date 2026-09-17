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
    <div className="mx-4 rounded-2xl border border-dashed border-[#c9793e]/50 bg-[#faeadb] px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a85f2c]">{label}</p>
        <p className="text-sm font-bold text-[#28432f] truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#a85f2c]">{ctaLabel}</span>
    </div>
  );
}
