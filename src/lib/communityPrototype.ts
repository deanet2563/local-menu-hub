export type CommunityPrototypeSurface =
  | "home"
  | "feed"
  | "groups"
  | "events"
  | "help"
  | "marketplace"
  | "map";

export type CommunityPrototypeVisibility = "public-directory" | "member-only" | "private-group";

export type CommunityPrototypeCommunity = {
  id: string;
  name: string;
  relationshipLabel: string;
  boundaryLabel: string;
  memberSummary: string;
};

export type CommunityPrototypePost = {
  id: string;
  communityId: string;
  kind: "announcement" | "discussion" | "safety";
  title: string;
  body: string;
  authorLabel: string;
  postedAtLabel: string;
  visibility: "member-only";
  isPinned?: boolean;
};

export type CommunityPrototypeGroup = {
  id: string;
  communityId: string;
  name: string;
  description: string;
  visibility: "public-to-community" | "private-group";
  memberCountLabel: string;
  nextActivityLabel: string;
};

export type CommunityPrototypeEvent = {
  id: string;
  communityId: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  placeLabel: string;
  organizerLabel: string;
  visibility: "member-only" | "private-group";
};

export type CommunityPrototypeHelpRequest = {
  id: string;
  communityId: string;
  category: "neighbor-help" | "lost-found" | "safety" | "maintenance";
  title: string;
  body: string;
  areaLabel: string;
  urgency: "low" | "medium" | "high";
  status: "open" | "in-progress" | "resolved";
};

export type CommunityPrototypeMarketplaceListing = {
  id: string;
  communityId: string;
  category: "buy" | "sell" | "share" | "free";
  title: string;
  summary: string;
  priceLabel: string;
  status: "active" | "reserved" | "sold";
  ownerLabel: string;
};

export type CommunityPrototypeMapEntry = {
  id: string;
  communityId: string;
  layer: "public-directory" | "private-community-map";
  name: string;
  category: string;
  locationLabel: string;
  precisionLabel: string;
  visibilityNote: string;
};

export const COMMUNITY_PROTOTYPE_COMMUNITIES: CommunityPrototypeCommunity[] = [
  {
    id: "sammakorn",
    name: "สัมมากร รามคำแหง 110/112",
    relationshipLabel: "บ้าน",
    boundaryLabel: "โครงการนำร่องสัมมากร",
    memberSummary: "สมาชิกที่ยืนยันแล้ว",
  },
  {
    id: "office-rama9",
    name: "ออฟฟิศพระราม 9",
    relationshipLabel: "ที่ทำงาน",
    boundaryLabel: "ตัวอย่างหลาย community",
    memberSummary: "รอเปิดใช้งานจริง",
  },
  {
    id: "school-circle",
    name: "กลุ่มผู้ปกครองโรงเรียน",
    relationshipLabel: "โรงเรียน",
    boundaryLabel: "ตัวอย่างวงโรงเรียน",
    memberSummary: "รอเปิดใช้งานจริง",
  },
];

export const COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY = COMMUNITY_PROTOTYPE_COMMUNITIES[0] as CommunityPrototypeCommunity;

export const COMMUNITY_PROTOTYPE_POSTS: CommunityPrototypePost[] = [
  {
    id: "post-pinned-safety",
    communityId: "sammakorn",
    kind: "announcement",
    title: "ประกาศทดลอง: กำหนดพื้นที่ใช้งาน Community",
    body: "ข้อมูลตัวอย่างสำหรับทดสอบ ยังไม่ใช่ประกาศจริงจากนิติบุคคลหรือผู้ดูแล",
    authorLabel: "ทีม MyTree Community",
    postedAtLabel: "วันนี้ 09:00",
    visibility: "member-only",
    isPinned: true,
  },
  {
    id: "post-discussion-1",
    communityId: "sammakorn",
    kind: "discussion",
    title: "ชวนคุยเรื่องตลาดนัดเล็ก ๆ วันเสาร์",
    body: "อยากสำรวจว่าลูกบ้านสนใจพื้นที่แลกเปลี่ยนของใช้หรืออาหารโฮมเมดแบบไม่รบกวนเพื่อนบ้านไหม",
    authorLabel: "สมาชิกบ้านเลขที่ปิดบัง",
    postedAtLabel: "เมื่อวาน 18:20",
    visibility: "member-only",
  },
  {
    id: "post-safety-1",
    communityId: "sammakorn",
    kind: "safety",
    title: "แจ้งเตือนพื้นที่เปียกบริเวณสวนกลาง",
    body: "โปรดเดินระวังบริเวณทางเดินสวนกลางหลังฝนตกหนัก จุดนี้ระบุเป็นพื้นที่รวม ไม่ใช่บ้านสมาชิก",
    authorLabel: "อาสาสมัครชุมชน",
    postedAtLabel: "เมื่อวาน 07:45",
    visibility: "member-only",
  },
];

export const COMMUNITY_PROTOTYPE_GROUPS: CommunityPrototypeGroup[] = [
  {
    id: "group-yoga",
    communityId: "sammakorn",
    name: "โยคะเช้าวันอาทิตย์",
    description: "กลุ่มกิจกรรมสุขภาพในสวนกลางสำหรับสมาชิกชุมชน",
    visibility: "public-to-community",
    memberCountLabel: "24 คน",
    nextActivityLabel: "อาทิตย์นี้ 07:00",
  },
  {
    id: "group-running",
    communityId: "sammakorn",
    name: "วิ่งรอบหมู่บ้าน",
    description: "นัดหมายวิ่งเบา ๆ พร้อมกติกาความปลอดภัยบนถนนในชุมชน",
    visibility: "public-to-community",
    memberCountLabel: "18 คน",
    nextActivityLabel: "พุธ 18:30",
  },
  {
    id: "group-parents",
    communityId: "sammakorn",
    name: "ผู้ปกครอง",
    description: "พื้นที่คุยเรื่องรถรับส่งและกิจกรรมเด็ก เฉพาะสมาชิกกลุ่ม",
    visibility: "private-group",
    memberCountLabel: "12 คน",
    nextActivityLabel: "ต้องเป็นสมาชิกกลุ่ม",
  },
  {
    id: "group-pets",
    communityId: "sammakorn",
    name: "สัตว์เลี้ยง",
    description: "แจ้งสัตว์หลุดหาย คำแนะนำดูแล และกิจกรรมที่เป็นมิตรกับเพื่อนบ้าน",
    visibility: "public-to-community",
    memberCountLabel: "31 คน",
    nextActivityLabel: "เสาร์ 16:00",
  },
];

export const COMMUNITY_PROTOTYPE_EVENTS: CommunityPrototypeEvent[] = [
  {
    id: "event-cleanup",
    communityId: "sammakorn",
    title: "อาสาทำความสะอาดสวนกลาง",
    dateLabel: "เสาร์ 21 ก.ย.",
    timeLabel: "08:00-10:00",
    placeLabel: "สวนกลางโซนหน้า",
    organizerLabel: "อาสาสมัครชุมชน",
    visibility: "member-only",
  },
  {
    id: "event-parents",
    communityId: "sammakorn",
    title: "นัดคุยกลุ่มผู้ปกครอง",
    dateLabel: "อาทิตย์ 22 ก.ย.",
    timeLabel: "15:30-16:30",
    placeLabel: "คลับเฮาส์ ห้องเล็ก",
    organizerLabel: "ผู้ดูแลกลุ่มผู้ปกครอง",
    visibility: "private-group",
  },
];

export const COMMUNITY_PROTOTYPE_HELP_REQUESTS: CommunityPrototypeHelpRequest[] = [
  {
    id: "help-lost-key",
    communityId: "sammakorn",
    category: "lost-found",
    title: "พบพวงกุญแจบริเวณสวนกลาง",
    body: "ฝากไว้ที่จุดรับของส่วนกลางแล้ว ไม่ระบุบ้านหรือพิกัดส่วนตัว",
    areaLabel: "พื้นที่รวม: สวนกลาง",
    urgency: "low",
    status: "open",
  },
  {
    id: "help-water",
    communityId: "sammakorn",
    category: "maintenance",
    title: "ทางเดินเปียกลื่นหลังฝนตก",
    body: "ขออาสาช่วยตั้งป้ายเตือนชั่วคราวในพื้นที่รวม",
    areaLabel: "พื้นที่รวม: ทางเดินสวน",
    urgency: "medium",
    status: "in-progress",
  },
  {
    id: "help-alert",
    communityId: "sammakorn",
    category: "safety",
    title: "ขอให้ช่วยสังเกตทางเข้าออกช่วงค่ำ",
    body: "แจ้งเป็นโซนกว้าง ไม่เปิดเผยตำแหน่งบ้านหรือข้อมูลส่วนบุคคล",
    areaLabel: "โซนทางเข้าออกหลัก",
    urgency: "high",
    status: "open",
  },
];

export const COMMUNITY_PROTOTYPE_MARKETPLACE: CommunityPrototypeMarketplaceListing[] = [
  {
    id: "market-free-books",
    communityId: "sammakorn",
    category: "free",
    title: "หนังสือเด็ก แบ่งปันฟรี",
    summary: "รับเองที่จุดนัดพบส่วนกลางตามเวลาที่ตกลง",
    priceLabel: "ฟรี",
    status: "active",
    ownerLabel: "สมาชิกที่ยืนยันแล้ว",
  },
  {
    id: "market-sell-chair",
    communityId: "sammakorn",
    category: "sell",
    title: "เก้าอี้ทำงานสภาพดี",
    summary: "รายการตัวอย่างสำหรับตลาดชุมชน แยกจากระบบสั่งอาหาร",
    priceLabel: "฿900",
    status: "reserved",
    ownerLabel: "สมาชิกในชุมชน",
  },
  {
    id: "market-share-tools",
    communityId: "sammakorn",
    category: "share",
    title: "ยืมบันไดพับช่วงสุดสัปดาห์",
    summary: "ติดต่อผ่านช่องทางชุมชนในอนาคต รอบนี้เป็นข้อมูลตัวอย่างเท่านั้น",
    priceLabel: "แบ่งปัน",
    status: "active",
    ownerLabel: "สมาชิกในชุมชน",
  },
];

export const COMMUNITY_PROTOTYPE_MAP_ENTRIES: CommunityPrototypeMapEntry[] = [
  {
    id: "map-cafe",
    communityId: "sammakorn",
    layer: "public-directory",
    name: "คาเฟ่ตัวอย่างที่ยืนยันแล้ว",
    category: "ร้านค้า/บริการ",
    locationLabel: "ที่อยู่สาธารณะที่ได้รับอนุมัติ",
    precisionLabel: "แสดงตำแหน่งจริงได้เมื่อเจ้าของหรือผู้ดูแลอนุมัติ",
    visibilityNote: "แสดงเฉพาะข้อมูลสาธารณะที่ได้รับอนุมัติ",
  },
  {
    id: "map-park",
    communityId: "sammakorn",
    layer: "public-directory",
    name: "สวนกลางชุมชน",
    category: "พื้นที่สาธารณะ",
    locationLabel: "ตำแหน่งพื้นที่รวม",
    precisionLabel: "ตำแหน่งสาธารณะที่อนุมัติแล้ว",
    visibilityNote: "ใช้สำหรับค้นหาสถานที่โดยไม่เปิดข้อมูลสมาชิก",
  },
  {
    id: "map-member-note",
    communityId: "sammakorn",
    layer: "private-community-map",
    name: "จุดนัดรับของส่วนกลาง",
    category: "ข้อมูลสำหรับสมาชิก",
    locationLabel: "ระบุเป็นโซน ไม่ใช่บ้านสมาชิก",
    precisionLabel: "ตำแหน่งโดยประมาณ",
    visibilityNote: "เห็นเฉพาะสมาชิกในชุมชนเดียวกัน",
  },
];

export function getCommunityPrototypeCommunity(communityId: string): CommunityPrototypeCommunity {
  return (
    COMMUNITY_PROTOTYPE_COMMUNITIES.find((community) => community.id === communityId)
    ?? COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY
  );
}
