import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/community/CommunityCards";
import { CommunityShell } from "@/components/community/CommunityShell";
import { CommunityPrototypeErrorState, CommunityStatePanel, DisabledPrototypeAction } from "@/components/community/CommunityStates";
import {
  COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY,
  canAccessCommunityPrototypeDetail,
  eventStatusLabel,
  getCommunityPrototypeCommunity,
  getCommunityPrototypeDetail,
  getCommunityPrototypeDetailDescription,
  getCommunityPrototypeMapLocation,
  groupStatusLabel,
  helpCategoryLabel,
  helpStatusLabel,
  isCommunityDetailScopeMismatch,
  mapStatusLabel,
  marketCategoryLabel,
  marketStatusLabel,
  postKindLabel,
  postStatusLabel,
  urgencyLabel,
  type CommunityPrototypeDetail,
  type CommunityPrototypeDetailKind,
  type CommunityPrototypeEvent,
  type CommunityPrototypeGroup,
  type CommunityPrototypeHelpRequest,
  type CommunityPrototypeMapEntry,
  type CommunityPrototypeMarketplaceListing,
  type CommunityPrototypePost,
  type CommunityPrototypeSurface,
} from "@/lib/communityPrototype";

type DetailViewModel = {
  title: string;
  typeLabel: string;
  statusLabel: string;
  privacyLabel: string;
  actorLabel: string;
  timeLabel: string;
  description: string;
  locationLabel?: string;
};

const DETAIL_CONFIG: Record<CommunityPrototypeDetailKind, {
  surface: CommunityPrototypeSurface;
  backTo: "/community/feed" | "/community/groups" | "/community/events" | "/community/help" | "/community/marketplace" | "/community/map";
  backLabel: string;
  actionLabel: string;
}> = {
  post: { surface: "feed", backTo: "/community/feed", backLabel: "กลับไปฟีด", actionLabel: "รายงานเนื้อหา" },
  group: { surface: "groups", backTo: "/community/groups", backLabel: "กลับไปรายการกลุ่ม", actionLabel: "สมัครกลุ่ม" },
  event: { surface: "events", backTo: "/community/events", backLabel: "กลับไปรายการกิจกรรม", actionLabel: "เข้าร่วมกิจกรรม" },
  help: { surface: "help", backTo: "/community/help", backLabel: "กลับไปคำขอความช่วยเหลือ", actionLabel: "รับช่วยเหลือ" },
  marketplace: { surface: "marketplace", backTo: "/community/marketplace", backLabel: "กลับไปตลาดชุมชน", actionLabel: "ติดต่อผู้ขาย" },
  map: { surface: "map", backTo: "/community/map", backLabel: "กลับไปแผนที่ชุมชน", actionLabel: "รายงานข้อมูลสถานที่" },
};

export function CommunityDetail({ kind, itemId }: { kind: CommunityPrototypeDetailKind; itemId: string }) {
  const [communityId, setCommunityId] = useState(COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY.id);
  const [loading, setLoading] = useState(true);
  const config = DETAIL_CONFIG[kind];
  const item = getCommunityPrototypeDetail(kind, itemId, COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY.id);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, [kind, itemId]);

  return (
    <CommunityShell surface={config.surface} communityId={communityId} onCommunityChange={setCommunityId}>
      <Link to={config.backTo} className="inline-flex min-h-11 items-center rounded-lg border border-moss-soft bg-white px-4 py-2 text-sm font-semibold text-moss-deep focus:outline-none focus:ring-2 focus:ring-clay">
        {config.backLabel}
      </Link>
      {loading ? <CommunityStatePanel tone="loading" title="กำลังเตรียมรายละเอียดตัวอย่าง" detail="กำลังอ่านข้อมูลตัวอย่างภายในหน้านี้ โดยไม่มีการติดต่อเซิร์ฟเวอร์" /> : null}
      {!loading && !item ? <CommunityStatePanel tone="not-found" title="ไม่พบรายการนี้" detail="รหัสรายการไม่อยู่ในข้อมูลตัวอย่าง หรือรายการไม่อยู่ในชุมชนนี้" /> : null}
      {!loading && item && isCommunityDetailScopeMismatch(item, communityId) ? (
        <CommunityStatePanel tone="locked" title="รายการนี้อยู่คนละชุมชน" detail="ข้อมูลจากชุมชนเดิมจะไม่แสดงภายใต้วงชุมชนที่เพิ่งเลือก กรุณากลับไปหน้า Community" />
      ) : null}
      {!loading && item && !isCommunityDetailScopeMismatch(item, communityId) ? <DetailContent kind={kind} item={item} actionLabel={config.actionLabel} /> : null}
    </CommunityShell>
  );
}

function DetailContent({ kind, item, actionLabel }: { kind: CommunityPrototypeDetailKind; item: CommunityPrototypeDetail; actionLabel: string }) {
  const detail = buildDetailViewModel(kind, item);
  const community = getCommunityPrototypeCommunity(item.communityId);
  const isLockedGroup = !canAccessCommunityPrototypeDetail(kind, item);
  const isUnavailableMap = kind === "map" && (item as CommunityPrototypeMapEntry).status === "unavailable";
  return (
    <article className="min-w-0 rounded-lg border border-[#e7e4dc] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap gap-2"><StatusBadge label={detail.typeLabel} tone="green" /><StatusBadge label={detail.statusLabel} tone="blue" /><StatusBadge label={detail.privacyLabel} /></div>
      <h2 className="mt-4 break-words text-pretty text-2xl font-bold">{detail.title}</h2>
      {!isLockedGroup && !isUnavailableMap ? <p className="mt-3 break-words text-pretty text-sm leading-6 text-ink-soft">{detail.description}</p> : null}
      <dl className="mt-5 grid gap-3 border-t border-[#e7e4dc] pt-4 text-sm">
        <DetailRow label="ชุมชน" value={community.name} />
        <DetailRow label="ขอบเขตความเป็นส่วนตัว" value={detail.privacyLabel} />
        <DetailRow label="ผู้โพสต์/ผู้ดูแล" value={detail.actorLabel} />
        <DetailRow label="วันที่และเวลา" value={detail.timeLabel} />
        {detail.locationLabel && !isLockedGroup ? <DetailRow label="พื้นที่" value={detail.locationLabel} /> : null}
      </dl>
      {isLockedGroup ? <div className="mt-5"><CommunityStatePanel tone="locked" title="ไม่มีสิทธิ์ดูเนื้อหาภายในกลุ่ม" detail="กลุ่มนี้เป็นพื้นที่ส่วนตัว บัญชีตัวอย่างนี้ยังไม่ได้รับสิทธิ์เข้าถึง" headingLevel={3} /></div> : null}
      {isUnavailableMap ? <div className="mt-5"><CommunityPrototypeErrorState title="ข้อมูลสถานที่ยังไม่พร้อมใช้งาน" detail="รายการนี้ปิดการแสดงตำแหน่งชั่วคราว การลองใหม่เป็นเพียงสถานะในหน้าทดลองและไม่ติดต่อเซิร์ฟเวอร์" headingLevel={3} /></div> : null}
      {!isLockedGroup && !isUnavailableMap ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <DisabledPrototypeAction label={actionLabel} />
          {kind !== "post" ? <DisabledPrototypeAction label="รายงานเนื้อหา" /> : <DisabledPrototypeAction label="ตอบกลับ" />}
        </div>
      ) : null}
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="grid min-w-0 gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-semibold text-ink-soft">{label}</dt><dd className="min-w-0 break-words text-pretty text-ink">{value}</dd></div>;
}

function buildDetailViewModel(kind: CommunityPrototypeDetailKind, item: CommunityPrototypeDetail): DetailViewModel {
  if (kind === "post") {
    const post = item as CommunityPrototypePost;
    return { title: post.title, typeLabel: postKindLabel(post.kind), statusLabel: postStatusLabel(post.status), privacyLabel: "เฉพาะสมาชิก", actorLabel: post.authorLabel, timeLabel: post.postedAtLabel, description: getCommunityPrototypeDetailDescription(kind, item) };
  }
  if (kind === "group") {
    const group = item as CommunityPrototypeGroup;
    return { title: group.name, typeLabel: "กลุ่ม/ชมรม", statusLabel: groupStatusLabel(group.status), privacyLabel: group.visibility === "private-group" ? "กลุ่มส่วนตัว" : "เห็นได้ในชุมชน", actorLabel: group.ownerLabel, timeLabel: group.createdAtLabel, description: getCommunityPrototypeDetailDescription(kind, item) };
  }
  if (kind === "event") {
    const event = item as CommunityPrototypeEvent;
    return { title: event.title, typeLabel: "กิจกรรม", statusLabel: eventStatusLabel(event.status), privacyLabel: event.visibility === "private-group" ? "กลุ่มส่วนตัว" : "เฉพาะสมาชิก", actorLabel: event.organizerLabel, timeLabel: `${event.dateLabel} · ${event.timeLabel}`, description: getCommunityPrototypeDetailDescription(kind, item), locationLabel: event.placeLabel };
  }
  if (kind === "help") {
    const request = item as CommunityPrototypeHelpRequest;
    return { title: request.title, typeLabel: `${helpCategoryLabel(request.category)} · ${urgencyLabel(request.urgency)}`, statusLabel: helpStatusLabel(request.status), privacyLabel: "เฉพาะสมาชิก", actorLabel: request.requesterLabel, timeLabel: request.requestedAtLabel, description: getCommunityPrototypeDetailDescription(kind, item), locationLabel: request.areaLabel };
  }
  if (kind === "marketplace") {
    const listing = item as CommunityPrototypeMarketplaceListing;
    return { title: listing.title, typeLabel: marketCategoryLabel(listing.category), statusLabel: marketStatusLabel(listing.status), privacyLabel: "เฉพาะสมาชิก", actorLabel: listing.ownerLabel, timeLabel: listing.postedAtLabel, description: getCommunityPrototypeDetailDescription(kind, item) };
  }
  const entry = item as CommunityPrototypeMapEntry;
  return { title: entry.name, typeLabel: entry.category, statusLabel: mapStatusLabel(entry.status), privacyLabel: entry.layer === "public-directory" ? "ข้อมูลสาธารณะที่อนุมัติแล้ว" : "เฉพาะสมาชิก", actorLabel: entry.ownerLabel, timeLabel: entry.updatedAtLabel, description: getCommunityPrototypeDetailDescription(kind, item), locationLabel: getCommunityPrototypeMapLocation(entry).label };
}
