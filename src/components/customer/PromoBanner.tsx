// ============================================================
// MyTree — Home promo banner (แบนเนอร์ของแพลตฟอร์มเอง).
//
// ดีไซน์แยกจาก SponsorCard ตั้งใจให้ผู้ใช้แยกออกว่าอันไหนคือ
// ประกาศของ MyTree อันไหนคือพื้นที่โฆษณา: ใช้โทนเขียวของแบรนด์
// เส้นขอบทึบ ไม่มี clay accent และไม่มี badge "สนับสนุนโดย".
// display-only เหมือน SponsorCard — props in, ไม่ fetch เอง.
// ============================================================

type Props = {
  emoji: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
};

export function PromoBanner({ emoji, title, subtitle, ctaLabel }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#E8F6E8] to-[#F5FAF1] p-4 ring-1 ring-[#CDE6CE]">
      <div className="absolute -right-6 -top-7 h-20 w-20 rounded-full bg-[#FF7417]/15" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm" aria-hidden="true">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#13863B]">ข่าวจาก MyTree</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-[#073D20]">{title}</p>
          <p className="mt-0.5 truncate text-xs text-[#5E7666]">{subtitle}</p>
        </div>
        {ctaLabel && <span className="shrink-0 rounded-full bg-[#087A31] px-3 py-2 text-[11px] font-bold text-white">{ctaLabel}</span>}
      </div>
    </section>
  );
}
