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
    <div className="mx-4 rounded-2xl border border-[#3f6b4a]/25 bg-[#e6ede4] px-4 py-3 flex items-center gap-3">
      <span className="shrink-0 text-2xl leading-none">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#28432f] truncate">{title}</p>
        <p className="text-xs text-gray-600 truncate">{subtitle}</p>
      </div>
      {ctaLabel && (
        <span className="shrink-0 rounded-full bg-[#3f6b4a] px-3 py-1 text-xs font-semibold text-white">{ctaLabel}</span>
      )}
    </div>
  );
}
