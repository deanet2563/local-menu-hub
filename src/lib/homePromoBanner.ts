// ============================================================
// MyTree — Home promo banner fixture.
//
// แยกจาก homeSponsorCards.ts โดยตั้งใจ: อันนี้คือแบนเนอร์ของ
// แพลตฟอร์มเอง (ประกาศ/แคมเปญ MyTree) ไม่ใช่พื้นที่โฆษณาที่ขาย
// จึงไม่มี sponsorLabel ("สนับสนุนโดย") และไม่ควรถูกเลือกด้วย
// placement/targeting แบบเดียวกับ sponsor slot.
//
// ยังไม่มี CMS/backend สำหรับประกาศ — เป็น static fixture ใบเดียว
// ที่สลับไป query จริงได้ทีหลังโดยไม่ต้องแตะ PromoBanner.tsx.
// ============================================================

export type PromoBanner = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
};

export const HOME_PROMO_BANNER: PromoBanner = {
  id: "mytree-launch",
  emoji: "🌳",
  title: "MyTree เปิดให้ใช้งานแล้ว",
  subtitle: "รวมร้านค้า ร้านอาหาร และบริการในชุมชนไว้ที่เดียว",
  ctaLabel: "เริ่มใช้งาน",
};
