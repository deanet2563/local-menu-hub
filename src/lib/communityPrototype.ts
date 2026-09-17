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
  status: "published" | "pending-review" | "removed";
  isPinned?: boolean;
};

export type CommunityPrototypeGroup = {
  id: string;
  communityId: string;
  name: string;
  description: string;
  visibility: "public-to-community" | "private-group";
  status: "open-to-community" | "private" | "locked";
  ownerLabel: string;
  createdAtLabel: string;
  hasAccess: boolean;
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
  status: "open" | "full" | "cancelled";
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
  visibility: "member-only";
  requesterLabel: string;
  requestedAtLabel: string;
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
  postedAtLabel: string;
  visibility: "member-only";
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
  status: "public-approved" | "private-approximate" | "unavailable";
  ownerLabel: string;
  updatedAtLabel: string;
  exactLocationOptIn: boolean;
};

export type CommunityPrototypeDetailKind = "post" | "group" | "event" | "help" | "marketplace" | "map";

export type CommunityPrototypeDetail =
  | CommunityPrototypePost
  | CommunityPrototypeGroup
  | CommunityPrototypeEvent
  | CommunityPrototypeHelpRequest
  | CommunityPrototypeMarketplaceListing
  | CommunityPrototypeMapEntry;

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
    title: "ประกาศทดลอง: กำหนดพื้นที่ใช้งานชุมชน",
    body: "ข้อมูลตัวอย่างสำหรับทดสอบ ยังไม่ใช่ประกาศจริงจากนิติบุคคลหรือผู้ดูแล",
    authorLabel: "ทีม MyTree Community",
    postedAtLabel: "วันนี้ 09:00",
    visibility: "member-only",
    status: "published",
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
    status: "published",
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
    status: "published",
  },
  {
    id: "post-pending-review",
    communityId: "sammakorn",
    kind: "discussion",
    title: "โพสต์ที่กำลังตรวจสอบ",
    body: "ระบบพบสัญญาณที่ต้องให้ผู้ดูแลตรวจสอบก่อนแสดงเนื้อหาเต็ม",
    authorLabel: "สมาชิกที่ยืนยันแล้ว",
    postedAtLabel: "วันนี้ 10:15",
    visibility: "member-only",
    status: "pending-review",
  },
  {
    id: "post-removed",
    communityId: "sammakorn",
    kind: "discussion",
    title: "เนื้อหาถูกนำออก",
    body: "รายการนี้ถูกนำออกตามกติกาชุมชนและไม่แสดงเนื้อหาเดิม",
    authorLabel: "ไม่แสดงข้อมูลผู้โพสต์",
    postedAtLabel: "เมื่อวาน 20:10",
    visibility: "member-only",
    status: "removed",
  },
];

export const COMMUNITY_PROTOTYPE_GROUPS: CommunityPrototypeGroup[] = [
  {
    id: "group-yoga",
    communityId: "sammakorn",
    name: "โยคะเช้าวันอาทิตย์",
    description: "กลุ่มกิจกรรมสุขภาพในสวนกลางสำหรับสมาชิกชุมชน",
    visibility: "public-to-community",
    status: "open-to-community",
    ownerLabel: "ผู้ดูแลกิจกรรมสุขภาพ",
    createdAtLabel: "เปิดกลุ่มเมื่อ 2 เดือนก่อน",
    hasAccess: true,
    memberCountLabel: "24 คน",
    nextActivityLabel: "อาทิตย์นี้ 07:00",
  },
  {
    id: "group-running",
    communityId: "sammakorn",
    name: "วิ่งรอบหมู่บ้าน",
    description: "นัดหมายวิ่งเบา ๆ พร้อมกติกาความปลอดภัยบนถนนในชุมชน",
    visibility: "public-to-community",
    status: "open-to-community",
    ownerLabel: "อาสาสมัครชุมชน",
    createdAtLabel: "เปิดกลุ่มเมื่อ 1 เดือนก่อน",
    hasAccess: true,
    memberCountLabel: "18 คน",
    nextActivityLabel: "พุธ 18:30",
  },
  {
    id: "group-parents",
    communityId: "sammakorn",
    name: "ผู้ปกครอง",
    description: "พื้นที่คุยเรื่องรถรับส่งและกิจกรรมเด็ก เฉพาะสมาชิกกลุ่ม",
    visibility: "private-group",
    status: "private",
    ownerLabel: "ผู้ดูแลกลุ่มผู้ปกครอง",
    createdAtLabel: "เปิดกลุ่มเมื่อ 3 สัปดาห์ก่อน",
    hasAccess: false,
    memberCountLabel: "12 คน",
    nextActivityLabel: "ต้องเป็นสมาชิกกลุ่ม",
  },
  {
    id: "group-pets",
    communityId: "sammakorn",
    name: "สัตว์เลี้ยง",
    description: "แจ้งสัตว์หลุดหาย คำแนะนำดูแล และกิจกรรมที่เป็นมิตรกับเพื่อนบ้าน",
    visibility: "public-to-community",
    status: "locked",
    ownerLabel: "ผู้ดูแลกลุ่มสัตว์เลี้ยง",
    createdAtLabel: "เปิดกลุ่มเมื่อ 6 สัปดาห์ก่อน",
    hasAccess: false,
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
    status: "open",
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
    status: "full",
  },
  {
    id: "event-cancelled",
    communityId: "sammakorn",
    title: "เวิร์กช็อปแยกขยะในบ้าน",
    dateLabel: "เสาร์ 28 ก.ย.",
    timeLabel: "10:00-11:30",
    placeLabel: "ศาลาส่วนกลาง",
    organizerLabel: "ทีมสิ่งแวดล้อมชุมชน",
    visibility: "member-only",
    status: "cancelled",
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
    visibility: "member-only",
    requesterLabel: "สมาชิกที่ยืนยันแล้ว",
    requestedAtLabel: "วันนี้ 08:20",
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
    visibility: "member-only",
    requesterLabel: "อาสาสมัครชุมชน",
    requestedAtLabel: "วันนี้ 07:40",
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
    visibility: "member-only",
    requesterLabel: "ผู้ดูแลพื้นที่ส่วนกลาง",
    requestedAtLabel: "เมื่อวาน 19:30",
  },
  {
    id: "help-resolved",
    communityId: "sammakorn",
    category: "neighbor-help",
    title: "ช่วยย้ายของไปจุดรับของส่วนกลาง",
    body: "มีสมาชิกช่วยเรียบร้อยแล้ว รายการคงอยู่เพื่อแสดงสถานะโดยไม่เปิดเผยบ้านของผู้ขอ",
    areaLabel: "จุดรับของส่วนกลาง",
    urgency: "low",
    status: "resolved",
    visibility: "member-only",
    requesterLabel: "สมาชิกที่ยืนยันแล้ว",
    requestedAtLabel: "2 วันที่แล้ว",
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
    postedAtLabel: "วันนี้ 11:00",
    visibility: "member-only",
  },
  {
    id: "market-sell-chair",
    communityId: "sammakorn",
    category: "sell",
    title: "เก้าอี้ทำงานสภาพดี",
    summary: "ตัวอย่างรายการในตลาดชุมชน แยกจากระบบสั่งอาหาร",
    priceLabel: "฿900",
    status: "reserved",
    ownerLabel: "สมาชิกในชุมชน",
    postedAtLabel: "เมื่อวาน 16:45",
    visibility: "member-only",
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
    postedAtLabel: "เมื่อวาน 09:15",
    visibility: "member-only",
  },
  {
    id: "market-sold-planter",
    communityId: "sammakorn",
    category: "sell",
    title: "กระถางต้นไม้มือสอง",
    summary: "ปิดรายการแล้วและเก็บไว้เพื่อแสดงสถานะโดยไม่เปิดข้อมูลผู้ซื้อ",
    priceLabel: "฿250",
    status: "sold",
    ownerLabel: "สมาชิกในชุมชน",
    postedAtLabel: "3 วันที่แล้ว",
    visibility: "member-only",
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
    status: "public-approved",
    ownerLabel: "เจ้าของสถานที่ที่ยืนยันแล้ว",
    updatedAtLabel: "ตรวจสอบล่าสุด 2 วันที่แล้ว",
    exactLocationOptIn: true,
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
    status: "public-approved",
    ownerLabel: "ผู้ดูแลชุมชน",
    updatedAtLabel: "ตรวจสอบล่าสุด 1 สัปดาห์ก่อน",
    exactLocationOptIn: true,
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
    status: "private-approximate",
    ownerLabel: "ผู้ดูแลพื้นที่ส่วนกลาง",
    updatedAtLabel: "ปรับปรุงวันนี้",
    exactLocationOptIn: false,
  },
  {
    id: "map-unavailable",
    communityId: "sammakorn",
    layer: "private-community-map",
    name: "จุดบริการที่ปิดชั่วคราว",
    category: "บริการชุมชน",
    locationLabel: "ไม่แสดงตำแหน่งระหว่างปิดบริการ",
    precisionLabel: "ไม่มีพิกัด",
    visibilityNote: "ข้อมูลไม่พร้อมใช้งานในขณะนี้",
    status: "unavailable",
    ownerLabel: "ผู้ดูแลชุมชน",
    updatedAtLabel: "ปรับปรุงเมื่อวาน",
    exactLocationOptIn: false,
  },
];

export function getCommunityPrototypeCommunity(communityId: string): CommunityPrototypeCommunity {
  return (
    COMMUNITY_PROTOTYPE_COMMUNITIES.find((community) => community.id === communityId)
    ?? COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY
  );
}

export function getCommunityPrototypeDetail(
  kind: CommunityPrototypeDetailKind,
  id: string,
  communityId: string,
): CommunityPrototypeDetail | undefined {
  const collections: Record<CommunityPrototypeDetailKind, CommunityPrototypeDetail[]> = {
    post: COMMUNITY_PROTOTYPE_POSTS,
    group: COMMUNITY_PROTOTYPE_GROUPS,
    event: COMMUNITY_PROTOTYPE_EVENTS,
    help: COMMUNITY_PROTOTYPE_HELP_REQUESTS,
    marketplace: COMMUNITY_PROTOTYPE_MARKETPLACE,
    map: COMMUNITY_PROTOTYPE_MAP_ENTRIES,
  };

  return collections[kind].find((item) => item.id === id && item.communityId === communityId);
}
