import { Link } from "@tanstack/react-router";
import { CommunityStatePanel } from "@/components/community/CommunityStates";
import {
  eventStatusLabel,
  groupStatusLabel,
  groupVisibilityLabel,
  helpCategoryLabel,
  helpStatusLabel,
  mapStatusLabel,
  marketCategoryLabel,
  marketStatusLabel,
  postKindLabel,
  postStatusLabel,
  selectCommunitySponsorCard,
  selectJoinedCommunityGroups,
  selectUpcomingCommunityEvents,
  urgencyLabel,
  type CommunityPrototypeEvent,
  type CommunityPrototypeGroup,
  type CommunityPrototypeHelpRequest,
  type CommunityPrototypeMapEntry,
  type CommunityPrototypeMarketplaceListing,
  type CommunityPrototypePost,
  type CommunityPrototypeSponsorCard,
} from "@/lib/communityPrototype";

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: "orange" | "green" | "blue" | "slate" }) {
  const classes = {
    orange: "border-clay bg-clay-soft text-clay-deep",
    green: "border-moss bg-moss-soft text-moss-deep",
    blue: "border-moss-soft bg-moss-soft text-moss-deep",
    slate: "border-[#e7e4dc] bg-cream text-ink-soft",
  }[tone];
  return <span aria-label={`สถานะ ${label}`} className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function DetailLink({ to, params, label }: { to: string; params: Record<string, string>; label: string }) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-moss underline-offset-4 focus:outline-none focus:ring-2 focus:ring-clay hover:underline"
    >
      {label}
    </Link>
  );
}

export function FeedSurface({
  posts,
  events,
  groups,
  favoriteGroupIds,
  communityId,
  sponsorCards,
}: {
  posts: CommunityPrototypePost[];
  events: CommunityPrototypeEvent[];
  groups: CommunityPrototypeGroup[];
  favoriteGroupIds: string[];
  communityId: string;
  sponsorCards: CommunityPrototypeSponsorCard[];
}) {
  const upcomingEvents = selectUpcomingCommunityEvents(events, communityId);
  const joinedGroups = selectJoinedCommunityGroups(groups, favoriteGroupIds, communityId);
  const sponsorTop = selectCommunitySponsorCard(sponsorCards, communityId, "feed-top");
  const sponsorMid = selectCommunitySponsorCard(sponsorCards, communityId, "feed-mid");
  return (
    <div className="space-y-6">
      <FeedSectionHeading title="กิจกรรมที่กำลังจะมาถึง" href="/community/events" icon="📅" />
      <section aria-label="กิจกรรมที่กำลังจะมาถึง" className="space-y-2">
        {upcomingEvents.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีกิจกรรมที่กำลังจะมาถึง" detail="กิจกรรมของชุมชนนี้จะแสดงในส่วนนี้" headingLevel={3} /> : upcomingEvents.map((event) => <EventPreviewCard key={event.id} event={event} />)}
      </section>

      {sponsorTop ? <SponsorCard card={sponsorTop} /> : null}

      <section aria-labelledby="community-latest-posts" className="space-y-3">
        <h2 id="community-latest-posts" className="text-base font-bold text-ink">โพสต์ล่าสุดในชุมชน</h2>
        {posts.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีโพสต์ในชุมชนนี้" detail="เมื่อมีโพสต์ที่มองเห็นได้ รายการจะแสดงที่นี่" /> : posts.map((post) => <PostCard key={post.id} post={post} />)}
      </section>

      {sponsorMid ? <SponsorCard card={sponsorMid} /> : null}

      <FeedSectionHeading title="กลุ่มที่คุณเข้าร่วม" href="/community/groups" icon="👥" />
      <section aria-label="กลุ่มที่คุณเข้าร่วม" className="space-y-2">
        {joinedGroups.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีกลุ่มที่ปักไว้" detail="ปักหมุดกลุ่มที่สนใจ แล้วรายการจะปรากฏในส่วนนี้" headingLevel={3} /> : joinedGroups.map((group) => <JoinedGroupPreviewCard key={group.id} group={group} />)}
      </section>
    </div>
  );
}

function SponsorCard({ card }: { card: CommunityPrototypeSponsorCard }) {
  if (card.variant === "banner") {
    return (
      <aside aria-label={`เนื้อหาสนับสนุนโดย ${card.title}`} className="min-w-0 overflow-hidden rounded-lg border border-clay-soft bg-white shadow-sm">
        <div className="relative flex h-20 items-center justify-center bg-gradient-to-br from-clay-soft to-white text-3xl" aria-hidden="true">
          {card.sponsorInitials}
          <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-clay-deep shadow-sm">สนับสนุนโดย</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="break-words text-pretty text-sm font-bold text-ink">{card.title}</p>
            <p className="mt-0.5 break-words text-pretty text-xs text-ink-soft">{card.subtitle}</p>
          </div>
          <span className="min-h-11 shrink-0 content-center rounded-lg bg-clay-deep px-3 py-2 text-xs font-bold text-white">{card.ctaLabel}</span>
        </div>
      </aside>
    );
  }
  return (
    <aside aria-label={`เนื้อหาสนับสนุนโดย ${card.title}`} className="relative flex min-w-0 items-center gap-3 rounded-lg border border-clay-soft bg-white p-3 pl-4 shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-lg before:bg-clay before:content-['']">
      <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-clay-soft text-sm font-extrabold text-clay-deep">
        {card.sponsorInitials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-clay-deep">สนับสนุนโดย</p>
        <p className="mt-0.5 break-words text-pretty text-sm font-bold text-ink">{card.title}</p>
        <p className="mt-0.5 break-words text-pretty text-xs text-ink-soft">{card.subtitle}</p>
      </div>
      <span className="min-h-11 shrink-0 content-center rounded-lg bg-clay-deep px-3 py-2 text-xs font-bold text-white">{card.ctaLabel}</span>
    </aside>
  );
}

function FeedSectionHeading({ title, href, icon }: { title: string; href: string; icon: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 break-words text-pretty text-base font-bold text-ink"><span aria-hidden="true">{icon}</span> {title}</h2>
      <Link to={href} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 text-sm font-semibold text-moss focus:outline-none focus:ring-2 focus:ring-clay">ดูทั้งหมด</Link>
    </div>
  );
}

function EventPreviewCard({ event }: { event: CommunityPrototypeEvent }) {
  return (
    <Link to="/community/events/$eventId" params={{ eventId: event.id }} className="flex min-h-16 min-w-0 items-center gap-3 rounded-lg border border-[#e7e4dc] bg-white p-3 focus:outline-none focus:ring-2 focus:ring-clay">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-clay-soft text-xl">📅</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-bold text-ink">{event.title}</span>
        <span className="mt-1 block break-words text-xs leading-5 text-ink-soft">{event.dateLabel} · {event.timeLabel} · {eventStatusLabel(event.status)}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-ink-faint">›</span>
    </Link>
  );
}

function JoinedGroupPreviewCard({ group }: { group: CommunityPrototypeGroup }) {
  return (
    <Link to="/community/groups/$groupId" params={{ groupId: group.id }} className="flex min-h-16 min-w-0 items-center gap-3 rounded-lg border border-[#e7e4dc] bg-white p-3 focus:outline-none focus:ring-2 focus:ring-clay">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-moss-soft text-xl">👥</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-bold text-ink">{group.name}</span>
        <span className="mt-1 block break-words text-xs leading-5 text-ink-soft">{group.memberCountLabel} · {groupVisibilityLabel(group)} · {groupStatusLabel(group.status)}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-ink-faint">›</span>
    </Link>
  );
}

export function PostCard({ post, compact = false }: { post: CommunityPrototypePost; compact?: boolean }) {
  return (
    <article className="min-w-0 rounded-lg border border-[#e7e4dc] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <StatusBadge label={postKindLabel(post.kind)} tone={post.kind === "safety" ? "orange" : "green"} />
        <StatusBadge label="เฉพาะสมาชิก" />
        <StatusBadge label={postStatusLabel(post.status)} tone={post.status === "published" ? "blue" : "orange"} />
      </div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{post.title}</h2>
      {!compact ? <p className="mt-2 break-words text-pretty text-sm leading-6 text-ink-soft">{post.body}</p> : null}
      <p className="mt-3 break-words text-pretty text-xs text-ink-faint">{post.authorLabel} · {post.postedAtLabel}</p>
      <DetailLink to="/community/feed/$postId" params={{ postId: post.id }} label="ดูรายละเอียดโพสต์" />
    </article>
  );
}

export function GroupsSurface({ groups, favorites, onToggleFavorite }: { groups: CommunityPrototypeGroup[]; favorites: string[]; onToggleFavorite: (id: string) => void }) {
  return (
    <section className="space-y-3">
      {groups.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีกลุ่มในชุมชนนี้" detail="กลุ่มที่เปิดให้เห็นจะปรากฏในส่วนนี้" /> : null}
      {groups.map((group) => {
        const favorite = favorites.includes(group.id);
        return (
          <article key={group.id} className="min-w-0 rounded-lg border border-[#e7e4dc] bg-white p-4 shadow-sm">
            <div className="flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2"><StatusBadge label={groupVisibilityLabel(group)} tone={group.hasAccess ? "green" : "slate"} /><StatusBadge label={groupStatusLabel(group.status)} /></div>
                <h2 className="mt-3 break-words text-pretty text-lg font-bold">{group.name}</h2>
              </div>
              <button type="button" aria-label={`${favorite ? "เลิกปักหมุด" : "ปักหมุด"} ${group.name}`} onClick={() => onToggleFavorite(group.id)} className="min-h-11 shrink-0 self-start rounded-lg border border-moss-soft px-3 py-2 text-sm font-semibold text-moss focus:outline-none focus:ring-2 focus:ring-clay">
                {favorite ? "ปักไว้แล้ว" : "ปักหมุด"}
              </button>
            </div>
            <p className="mt-2 break-words text-pretty text-sm leading-6 text-ink-soft">{group.description}</p>
            <p className="mt-3 break-words text-pretty text-sm text-ink-faint">{group.memberCountLabel} · {group.nextActivityLabel}</p>
            <DetailLink to="/community/groups/$groupId" params={{ groupId: group.id }} label="ดูรายละเอียดกลุ่ม" />
          </article>
        );
      })}
    </section>
  );
}

export function EventsSurface({ events }: { events: CommunityPrototypeEvent[] }) {
  return <section className="space-y-3">{events.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีกิจกรรม" detail="กิจกรรมที่เปิดให้ชุมชนจะปรากฏที่นี่" /> : events.map((event) => <EventCard key={event.id} event={event} />)}</section>;
}

function EventCard({ event }: { event: CommunityPrototypeEvent }) {
  return (
    <article className="min-w-0 rounded-lg border border-[#e7e4dc] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2"><StatusBadge label={event.visibility === "private-group" ? "กลุ่มส่วนตัว" : "เฉพาะสมาชิก"} /><StatusBadge label={eventStatusLabel(event.status)} tone={event.status === "cancelled" ? "orange" : "blue"} /></div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{event.title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{event.dateLabel} · {event.timeLabel}</p>
      <p className="text-sm leading-6 text-ink-soft">{event.placeLabel} · {event.organizerLabel}</p>
      <DetailLink to="/community/events/$eventId" params={{ eventId: event.id }} label="ดูรายละเอียดกิจกรรม" />
    </article>
  );
}

export function HelpSurface({ requests }: { requests: CommunityPrototypeHelpRequest[] }) {
  return <section className="space-y-3">{requests.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีคำขอความช่วยเหลือ" detail="คำขอที่มองเห็นได้ในชุมชนจะปรากฏที่นี่" /> : requests.map((request) => <HelpCard key={request.id} request={request} />)}</section>;
}

function HelpCard({ request }: { request: CommunityPrototypeHelpRequest }) {
  return (
    <article className="min-w-0 rounded-lg border border-[#e7e4dc] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2"><StatusBadge label={helpCategoryLabel(request.category)} /><StatusBadge label={urgencyLabel(request.urgency)} tone={request.urgency === "high" ? "orange" : "green"} /><StatusBadge label={helpStatusLabel(request.status)} tone="blue" /></div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{request.title}</h2>
      <p className="mt-2 break-words text-pretty text-sm leading-6 text-ink-soft">{request.body}</p>
      <p className="mt-3 break-words text-pretty text-sm font-medium text-ink">{request.areaLabel}</p>
      <DetailLink to="/community/help/$requestId" params={{ requestId: request.id }} label="ดูรายละเอียดคำขอ" />
    </article>
  );
}

export function MarketplaceSurface({ listings }: { listings: CommunityPrototypeMarketplaceListing[] }) {
  return (
    <section className="space-y-3">
      <div className="min-w-0 break-words text-pretty rounded-lg border border-[#e7e4dc] bg-white p-4 text-sm leading-6 text-ink-soft">ตลาดชุมชนสำหรับซื้อ ขาย แบ่งปัน และให้ฟรี แยกจากระบบสั่งอาหาร</div>
      {listings.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีรายการตลาดชุมชน" detail="รายการซื้อ ขาย แบ่งปัน และให้ฟรีจะปรากฏที่นี่" /> : listings.map((listing) => <MarketplaceCard key={listing.id} listing={listing} />)}
    </section>
  );
}

function MarketplaceCard({ listing }: { listing: CommunityPrototypeMarketplaceListing }) {
  return (
    <article className="min-w-0 rounded-lg border border-[#e7e4dc] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2"><StatusBadge label={marketCategoryLabel(listing.category)} tone="green" /><StatusBadge label={marketStatusLabel(listing.status)} tone={listing.status === "active" ? "blue" : "slate"} /></div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{listing.title}</h2>
      <p className="mt-2 break-words text-pretty text-sm leading-6 text-ink-soft">{listing.summary}</p>
      <p className="mt-3 break-words text-sm font-semibold text-clay-deep">{listing.priceLabel}</p>
      <p className="mt-1 text-xs text-ink-faint">{listing.ownerLabel}</p>
      <DetailLink to="/community/marketplace/$listingId" params={{ listingId: listing.id }} label="ดูรายละเอียดรายการ" />
    </article>
  );
}

export function MapSurface({ entries }: { entries: CommunityPrototypeMapEntry[] }) {
  const publicEntries = entries.filter((entry) => entry.layer === "public-directory");
  const privateEntries = entries.filter((entry) => entry.layer === "private-community-map");
  return (
    <section className="space-y-3">
      <MapLayer title="รายชื่อสถานที่สาธารณะ" detail="แสดงเฉพาะสถานที่สาธารณะหรือร้านค้าและบริการที่ได้รับอนุญาตแล้ว" entries={publicEntries} />
      <MapLayer title="แผนที่เฉพาะสมาชิก" detail="ไม่แสดงบ้านหรือพิกัดแม่นยำของสมาชิก" entries={privateEntries} />
    </section>
  );
}

function MapLayer({ title, detail, entries }: { title: string; detail: string; entries: CommunityPrototypeMapEntry[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-[#e7e4dc] bg-white p-4 shadow-sm">
      <h2 className="break-words text-pretty text-lg font-bold">{title}</h2>
      <p className="mt-2 break-words text-pretty text-sm leading-6 text-ink-soft">{detail}</p>
      <div className="mt-3 space-y-3">
        {entries.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีรายการ" detail="สถานที่ที่ผ่านเงื่อนไขจะแสดงในส่วนนี้" /> : entries.map((entry) => (
          <article key={entry.id} className="min-w-0 rounded-lg border border-[#e7e4dc] bg-cream p-3">
            <div className="flex flex-wrap gap-2"><StatusBadge label={mapStatusLabel(entry.status)} tone={entry.status === "unavailable" ? "orange" : "green"} /><StatusBadge label={entry.layer === "public-directory" ? "สาธารณะ" : "เฉพาะสมาชิก"} /></div>
            <h3 className="mt-3 break-words text-pretty font-semibold">{entry.name}</h3>
            <p className="mt-1 break-words text-pretty text-sm text-ink-soft">{entry.category}</p>
            <p className="mt-2 break-words text-pretty text-sm text-ink">{entry.locationLabel}</p>
            <p className="mt-1 break-words text-pretty text-xs text-ink-faint">{entry.precisionLabel}</p>
            <DetailLink to="/community/map/$entryId" params={{ entryId: entry.id }} label="ดูรายละเอียดสถานที่" />
          </article>
        ))}
      </div>
    </section>
  );
}
