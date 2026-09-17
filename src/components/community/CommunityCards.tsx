import { Link } from "@tanstack/react-router";
import { CommunityStatePanel, DisabledPrototypeAction } from "@/components/community/CommunityStates";
import {
  COMMUNITY_NAV_ITEMS,
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
  urgencyLabel,
  type CommunityPrototypeEvent,
  type CommunityPrototypeGroup,
  type CommunityPrototypeHelpRequest,
  type CommunityPrototypeMapEntry,
  type CommunityPrototypeMarketplaceListing,
  type CommunityPrototypePost,
} from "@/lib/communityPrototype";

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: "orange" | "green" | "blue" | "slate" }) {
  const classes = {
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  }[tone];
  return <span aria-label={`สถานะ ${label}`} className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function DetailLink({ to, params, label }: { to: string; params: Record<string, string>; label: string }) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-orange-700 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-orange-300 hover:underline"
    >
      {label}
    </Link>
  );
}

export function HomeSurface({ posts }: { posts: CommunityPrototypePost[] }) {
  const pinned = posts.find((post) => post.isPinned);
  return (
    <>
      {pinned ? <PostCard post={pinned} compact /> : <CommunityStatePanel tone="empty" title="ยังไม่มีประกาศปักหมุด" detail="เมื่อมีประกาศสำคัญ รายการจะแสดงในส่วนนี้" />}
      <section aria-label="ทางลัด Community" className="grid min-w-0 grid-cols-2 gap-3 max-[374px]:grid-cols-1">
        {COMMUNITY_NAV_ITEMS.filter((item) => item.id !== "home").map((item) => (
          <Link key={item.id} to={item.href} className="min-h-11 min-w-0 rounded-lg border border-orange-100 bg-white p-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
            {item.label}<span className="mt-2 block text-xs font-normal leading-5 text-slate-500">ดูตัวอย่าง</span>
          </Link>
        ))}
      </section>
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 break-words text-base font-bold">ตัวอย่างฟีดล่าสุด</h2>
          <Link to="/community/feed" className="min-h-11 shrink-0 content-center text-sm font-semibold text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300">ดูทั้งหมด</Link>
        </div>
        <div className="mt-3 space-y-3">{posts.filter((post) => post.status === "published").slice(0, 2).map((post) => <PostCard key={post.id} post={post} compact />)}</div>
      </section>
    </>
  );
}

export function FeedSurface({ posts }: { posts: CommunityPrototypePost[] }) {
  return (
    <section className="space-y-3">
      <DisabledPrototypeAction label="สร้างโพสต์" />
      {posts.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีโพสต์ในชุมชนนี้" detail="เมื่อมีโพสต์ที่มองเห็นได้ รายการจะแสดงที่นี่" /> : null}
      {posts.map((post) => <PostCard key={post.id} post={post} />)}
    </section>
  );
}

export function PostCard({ post, compact = false }: { post: CommunityPrototypePost; compact?: boolean }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <StatusBadge label={postKindLabel(post.kind)} tone={post.kind === "safety" ? "orange" : "green"} />
        <StatusBadge label="เฉพาะสมาชิก" />
        <StatusBadge label={postStatusLabel(post.status)} tone={post.status === "published" ? "blue" : "orange"} />
      </div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{post.title}</h2>
      {!compact ? <p className="mt-2 break-words text-pretty text-sm leading-6 text-slate-600">{post.body}</p> : null}
      <p className="mt-3 break-words text-pretty text-xs text-slate-500">{post.authorLabel} · {post.postedAtLabel}</p>
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
          <article key={group.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2"><StatusBadge label={groupVisibilityLabel(group)} tone={group.hasAccess ? "green" : "slate"} /><StatusBadge label={groupStatusLabel(group.status)} /></div>
                <h2 className="mt-3 break-words text-pretty text-lg font-bold">{group.name}</h2>
              </div>
              <button type="button" aria-label={`${favorite ? "เลิกปักหมุด" : "ปักหมุด"} ${group.name}`} onClick={() => onToggleFavorite(group.id)} className="min-h-11 shrink-0 self-start rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300">
                {favorite ? "ปักไว้แล้ว" : "ปักหมุด"}
              </button>
            </div>
            <p className="mt-2 break-words text-pretty text-sm leading-6 text-slate-600">{group.description}</p>
            <p className="mt-3 break-words text-pretty text-sm text-slate-500">{group.memberCountLabel} · {group.nextActivityLabel}</p>
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
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2"><StatusBadge label={event.visibility === "private-group" ? "กลุ่มส่วนตัว" : "เฉพาะสมาชิก"} /><StatusBadge label={eventStatusLabel(event.status)} tone={event.status === "cancelled" ? "orange" : "blue"} /></div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{event.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{event.dateLabel} · {event.timeLabel}</p>
      <p className="text-sm leading-6 text-slate-600">{event.placeLabel} · {event.organizerLabel}</p>
      <DetailLink to="/community/events/$eventId" params={{ eventId: event.id }} label="ดูรายละเอียดกิจกรรม" />
    </article>
  );
}

export function HelpSurface({ requests }: { requests: CommunityPrototypeHelpRequest[] }) {
  return <section className="space-y-3">{requests.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีคำขอความช่วยเหลือ" detail="คำขอที่มองเห็นได้ในชุมชนจะปรากฏที่นี่" /> : requests.map((request) => <HelpCard key={request.id} request={request} />)}</section>;
}

function HelpCard({ request }: { request: CommunityPrototypeHelpRequest }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2"><StatusBadge label={helpCategoryLabel(request.category)} /><StatusBadge label={urgencyLabel(request.urgency)} tone={request.urgency === "high" ? "orange" : "green"} /><StatusBadge label={helpStatusLabel(request.status)} tone="blue" /></div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{request.title}</h2>
      <p className="mt-2 break-words text-pretty text-sm leading-6 text-slate-600">{request.body}</p>
      <p className="mt-3 break-words text-pretty text-sm font-medium text-slate-700">{request.areaLabel}</p>
      <DetailLink to="/community/help/$requestId" params={{ requestId: request.id }} label="ดูรายละเอียดคำขอ" />
    </article>
  );
}

export function MarketplaceSurface({ listings }: { listings: CommunityPrototypeMarketplaceListing[] }) {
  return (
    <section className="space-y-3">
      <div className="min-w-0 break-words text-pretty rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">ตลาดชุมชนสำหรับซื้อ ขาย แบ่งปัน และให้ฟรี แยกจากระบบสั่งอาหาร</div>
      {listings.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีรายการตลาดชุมชน" detail="รายการซื้อ ขาย แบ่งปัน และให้ฟรีจะปรากฏที่นี่" /> : listings.map((listing) => <MarketplaceCard key={listing.id} listing={listing} />)}
    </section>
  );
}

function MarketplaceCard({ listing }: { listing: CommunityPrototypeMarketplaceListing }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2"><StatusBadge label={marketCategoryLabel(listing.category)} tone="green" /><StatusBadge label={marketStatusLabel(listing.status)} tone={listing.status === "active" ? "blue" : "slate"} /></div>
      <h2 className="mt-3 break-words text-pretty text-lg font-bold">{listing.title}</h2>
      <p className="mt-2 break-words text-pretty text-sm leading-6 text-slate-600">{listing.summary}</p>
      <p className="mt-3 break-words text-sm font-semibold text-orange-700">{listing.priceLabel}</p>
      <p className="mt-1 text-xs text-slate-500">{listing.ownerLabel}</p>
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
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="break-words text-pretty text-lg font-bold">{title}</h2>
      <p className="mt-2 break-words text-pretty text-sm leading-6 text-slate-600">{detail}</p>
      <div className="mt-3 space-y-3">
        {entries.length === 0 ? <CommunityStatePanel tone="empty" title="ยังไม่มีรายการ" detail="สถานที่ที่ผ่านเงื่อนไขจะแสดงในส่วนนี้" /> : entries.map((entry) => (
          <article key={entry.id} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2"><StatusBadge label={mapStatusLabel(entry.status)} tone={entry.status === "unavailable" ? "orange" : "green"} /><StatusBadge label={entry.layer === "public-directory" ? "สาธารณะ" : "เฉพาะสมาชิก"} /></div>
            <h3 className="mt-3 break-words text-pretty font-semibold">{entry.name}</h3>
            <p className="mt-1 break-words text-pretty text-sm text-slate-600">{entry.category}</p>
            <p className="mt-2 break-words text-pretty text-sm text-slate-700">{entry.locationLabel}</p>
            <p className="mt-1 break-words text-pretty text-xs text-slate-500">{entry.precisionLabel}</p>
            <DetailLink to="/community/map/$entryId" params={{ entryId: entry.id }} label="ดูรายละเอียดสถานที่" />
          </article>
        ))}
      </div>
    </section>
  );
}
