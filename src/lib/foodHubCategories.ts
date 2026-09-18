// ============================================================
// MyTree — Food Hub category buckets.
//
// menu_items.category is free text entered per-shop (confirmed via
// the staging DB: values like "Drinks", "Legacy Desserts",
// "เครื่องดื่ม/ชา/กาแฟ" alongside clean Thai labels) and there is no
// schema field that groups them into the approved 8-category design
// (menu_items.category_id -> shop_menu_categories is a per-shop
// custom list, not a shared taxonomy). Per direction, this is a
// static frontend synonym map only — no backend/schema change.
//
// Any raw category that isn't listed in a bucket's `matches` (e.g. a
// future shop entering something new) simply doesn't match any
// specific bucket filter and keeps showing under "ทั้งหมด" (no
// filter) — it never disappears or throws.
// ============================================================

export type CategoryBucket = {
  key: string;
  label: string;
  icon: string;
  /** Raw menu_items.category values that belong to this bucket. */
  matches: string[];
};

export const CATEGORY_BUCKETS: CategoryBucket[] = [
  { key: "single-dish", label: "จานเดียว", icon: "🍛", matches: ["จานเดียว", "อาหารตามสั่ง", "ต้ม/แกง"] },
  { key: "noodles", label: "ก๋วยเตี๋ยว", icon: "🍜", matches: ["ก๋วยเตี๋ยว"] },
  { key: "dimsum", label: "ติ่มซำ", icon: "🥟", matches: ["ติ่มซำ", "ซาลาเปา", "ซาลาเปา/ติ่มซำ"] },
  { key: "drinks", label: "เครื่องดื่ม", icon: "🥤", matches: ["เครื่องดื่ม", "Drinks", "เครื่องดื่ม/ชา/กาแฟ", "ชานม", "คาเฟ่"] },
  { key: "desserts", label: "ของหวาน", icon: "🍧", matches: ["ขนมหวาน", "Desserts", "Legacy Desserts", "ขนมไทย"] },
  { key: "bakery", label: "เบเกอรี่", icon: "🥐", matches: ["เบเกอรี่", "ขนมปัง"] },
  // No matching data in menu_items.category yet — kept as a real,
  // selectable bucket per direction (renders empty, never errors).
  { key: "snacks", label: "ของทานเล่น", icon: "🍢", matches: [] },
];

export const ALL_BUCKET_KEY = "all";

export const CATEGORY_TILES: CategoryBucket[] = [
  ...CATEGORY_BUCKETS,
  { key: ALL_BUCKET_KEY, label: "ทั้งหมด", icon: "🍽️", matches: [] },
];

/** The bucket key a raw menu_items.category value belongs to, or null if
 * it isn't in any bucket's synonym list (still shown under "ทั้งหมด"). */
export function bucketKeyForCategory(category: string | null): string | null {
  if (!category) return null;
  return CATEGORY_BUCKETS.find((b) => b.matches.includes(category))?.key ?? null;
}
