export const HEAD_OFFICE_SECTIONS = [
  { key: "overview", label: "Overview", shortLabel: "OV" },
  { key: "communities", label: "Communities", shortLabel: "CO" },
  { key: "members", label: "Members", shortLabel: "ME" },
  { key: "shops", label: "Shops", shortLabel: "SH" },
  { key: "riders", label: "Riders", shortLabel: "RI" },
  { key: "orders", label: "Orders", shortLabel: "OR" },
  { key: "map", label: "Map", shortLabel: "MA" },
  { key: "moderation", label: "Moderation", shortLabel: "MO" },
  { key: "marketplace", label: "Marketplace", shortLabel: "MK" },
  { key: "promotions", label: "Promotions", shortLabel: "PR" },
  { key: "ads", label: "Ads", shortLabel: "AD" },
  { key: "pos", label: "POS", shortLabel: "PO" },
  { key: "support", label: "Support", shortLabel: "SU" },
  { key: "ai-office", label: "AI Office", shortLabel: "AI" },
  { key: "analytics", label: "Analytics", shortLabel: "AN" },
  { key: "system", label: "System", shortLabel: "SY" },
] as const;

export type HeadOfficeSection = (typeof HEAD_OFFICE_SECTIONS)[number]["key"];

export function isHeadOfficeSection(value: string): value is HeadOfficeSection {
  return HEAD_OFFICE_SECTIONS.some((item) => item.key === value);
}

export function getHeadOfficeSection(section: HeadOfficeSection) {
  return HEAD_OFFICE_SECTIONS.find((item) => item.key === section)!;
}

export function headOfficePath(section: HeadOfficeSection) {
  return section === "overview" ? "/head-office" : `/head-office/${section}`;
}
