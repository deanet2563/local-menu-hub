// ============================================================
// MyTree — Home sponsor card fixture.
//
// Mirrors the shape the Community lane uses for its sponsor slots
// (placement-based selection) but drops communityIds targeting —
// Home isn't scoped to a single community, so every card is eligible
// everywhere. No ads backend exists yet; this is a static fixture the
// selector reads from, easy to swap for a real query later.
// ============================================================

export type HomeSponsorCardPlacement = "top" | "mid";

export type HomeSponsorCard = {
  id: string;
  placement: HomeSponsorCardPlacement;
  sponsorLabel: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
};

export const HOME_SPONSOR_CARDS: HomeSponsorCard[] = [
  {
    id: "ratri-kuromame-tea",
    placement: "top",
    sponsorLabel: "สนับสนุนโดย",
    title: "RATRI Kuromame Tea",
    subtitle: "ชาถั่วดำคั่ว หอมกลมกล่อม ลองเลยวันนี้",
    ctaLabel: "ดูเพิ่มเติม",
  },
  {
    id: "baan-suan-hardware",
    placement: "mid",
    sponsorLabel: "สนับสนุนโดย",
    title: "ร้านวัสดุก่อสร้างบ้านสวน",
    subtitle: "อุปกรณ์ช่าง-ซ่อมแซมบ้าน ราคาชุมชน",
    ctaLabel: "ดูเพิ่มเติม",
  },
];

export function selectHomeSponsorCard(
  cards: HomeSponsorCard[],
  placement: HomeSponsorCardPlacement
): HomeSponsorCard | null {
  return cards.find((c) => c.placement === placement) ?? null;
}
