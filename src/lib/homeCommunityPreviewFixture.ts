// ============================================================
// MyTree — Home community-feed preview fixture.
//
// duplicate ชั่วคราว รอ merge Community lane เข้า main แล้วค่อยรวมเป็นที่เดียว
//
// codex/community-phase3-foundation (a separate worktree) owns the
// real community fixture (COMMUNITY_NAV_ITEMS / posts / events) but
// isn't merged into this branch, and nothing here cross-imports
// across worktrees. This is a small local stand-in just for the Home
// preview strip — not meant to stay in sync with the Community lane's
// data shape long-term.
// ============================================================

// TODO: static community name — real community membership/scoping comes from
// Community lane (codex/community-phase3-foundation), not yet merged. Replace
// with dynamic value once merged.
//
// Sammakorn Village เป็น pilot community เดียวที่มีอยู่จริงตอนนี้ Home จึง
// ตั้งชื่อนี้ค้างไว้ได้ — แต่ทันทีที่มีชุมชนที่สอง label นี้จะกลายเป็นข้อมูลผิด
// สำหรับผู้ใช้ชุมชนอื่น ไม่ใช่แค่ค่า default ที่ไม่อัปเดต.
export const CURRENT_COMMUNITY_NAME = "สัมมากรวิลเลจ";

export type HomeCommunityEvent = {
  id: string;
  title: string;
  whenLabel: string;
  locationLabel: string;
};

export type HomeCommunityPost = {
  id: string;
  author: string;
  excerpt: string;
};

export const HOME_COMMUNITY_EVENTS: HomeCommunityEvent[] = [
  { id: "evt-1", title: "ตลาดนัดชุมชนสายไหม", whenLabel: "เสาร์นี้ 07:00", locationLabel: "สนามกีฬาหมู่บ้าน" },
  { id: "evt-2", title: "รวมของมือสองประจำเดือน", whenLabel: "อาทิตย์หน้า 09:00", locationLabel: "ศาลาประชาคม" },
];

export const HOME_COMMUNITY_POSTS: HomeCommunityPost[] = [
  { id: "post-1", author: "คุณแนน", excerpt: "มีใครแนะนำร้านซ่อมแอร์แถวนี้บ้างคะ" },
  { id: "post-2", author: "พี่โจ้", excerpt: "วันนี้ตลาดเปิดปกติค่ะ ของสดมาเยอะ" },
  { id: "post-3", author: "คุณส้ม", excerpt: "ขอบคุณร้าน SonBaoBao ซาลาเปาอร่อยมากก" },
];
