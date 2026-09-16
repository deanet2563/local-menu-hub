import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  COMMUNITY_PROTOTYPE_COMMUNITIES,
  COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY,
  COMMUNITY_PROTOTYPE_EVENTS,
  COMMUNITY_PROTOTYPE_GROUPS,
  COMMUNITY_PROTOTYPE_HELP_REQUESTS,
  COMMUNITY_PROTOTYPE_MAP_ENTRIES,
  COMMUNITY_PROTOTYPE_MARKETPLACE,
  COMMUNITY_PROTOTYPE_POSTS,
  type CommunityPrototypeSurface,
  getCommunityPrototypeCommunity,
} from "@/lib/communityPrototype";

type CommunityPrototypeProps = {
  surface: CommunityPrototypeSurface;
};

const surfaceNav: { id: CommunityPrototypeSurface; label: string; href: string }[] = [
  { id: "home", label: "หน้าแรก", href: "/community" },
  { id: "feed", label: "ฟีด", href: "/community/feed" },
  { id: "groups", label: "กลุ่ม", href: "/community/groups" },
  { id: "events", label: "กิจกรรม", href: "/community/events" },
  { id: "help", label: "ช่วยเหลือ", href: "/community/help" },
  { id: "marketplace", label: "ตลาดชุมชน", href: "/community/marketplace" },
  { id: "map", label: "แผนที่", href: "/community/map" },
];

export function CommunityPrototype({ surface }: CommunityPrototypeProps) {
  const [communityId, setCommunityId] = useState(COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY.id);
  const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>(["group-yoga"]);
  const activeCommunity = getCommunityPrototypeCommunity(communityId);
  const posts = useMemo(
    () => COMMUNITY_PROTOTYPE_POSTS.filter((item) => item.communityId === communityId),
    [communityId],
  );
  const groups = useMemo(
    () => COMMUNITY_PROTOTYPE_GROUPS.filter((item) => item.communityId === communityId),
    [communityId],
  );
  const events = useMemo(
    () => COMMUNITY_PROTOTYPE_EVENTS.filter((item) => item.communityId === communityId),
    [communityId],
  );
  const helpRequests = useMemo(
    () => COMMUNITY_PROTOTYPE_HELP_REQUESTS.filter((item) => item.communityId === communityId),
    [communityId],
  );
  const listings = useMemo(
    () => COMMUNITY_PROTOTYPE_MARKETPLACE.filter((item) => item.communityId === communityId),
    [communityId],
  );
  const mapEntries = useMemo(
    () => COMMUNITY_PROTOTYPE_MAP_ENTRIES.filter((item) => item.communityId === communityId),
    [communityId],
  );

  function toggleFavorite(groupId: string) {
    setFavoriteGroupIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ));
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] pb-20 text-slate-950">
      <header className="border-b border-orange-100 bg-white">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4">
          <PrototypeNotice />
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-slate-600" htmlFor="community-switcher">
              เลือกวงชุมชน
            </label>
            <select
              id="community-switcher"
              value={communityId}
              onChange={(event) => setCommunityId(event.target.value)}
              className="w-full rounded-xl border border-orange-200 bg-white px-3 py-3 text-base font-semibold text-slate-900 shadow-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              {COMMUNITY_PROTOTYPE_COMMUNITIES.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name} - {community.relationshipLabel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium text-orange-700">{activeCommunity.relationshipLabel}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{activeCommunity.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {activeCommunity.boundaryLabel} · {activeCommunity.memberSummary}
            </p>
          </div>
          <nav aria-label="Community prototype navigation" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {surfaceNav.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-300 ${
                  surface === item.id
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-orange-100 bg-white text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
        {surface === "home" && <HomeSurface posts={posts} />}
        {surface === "feed" && <FeedSurface posts={posts} />}
        {surface === "groups" && (
          <GroupsSurface
            groups={groups}
            favoriteGroupIds={favoriteGroupIds}
            onToggleFavorite={toggleFavorite}
          />
        )}
        {surface === "events" && <EventsSurface events={events} />}
        {surface === "help" && <HelpSurface requests={helpRequests} />}
        {surface === "marketplace" && <MarketplaceSurface listings={listings} />}
        {surface === "map" && <MapSurface entries={mapEntries} />}
      </div>
    </main>
  );
}

function PrototypeNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
      ข้อมูลตัวอย่างสำหรับทดสอบ Community: ข้อมูลทั้งหมดเป็น fixture ยังไม่เชื่อมฐานข้อมูล และยังไม่มีการสร้างหรือบันทึกข้อมูลจริง
    </div>
  );
}

function HomeSurface({ posts }: { posts: typeof COMMUNITY_PROTOTYPE_POSTS }) {
  const pinned = posts.find((post) => post.isPinned);
  return (
    <>
      {pinned && (
        <section className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
          <StatusPill label="ปักหมุด" tone="orange" />
          <h2 className="mt-3 text-lg font-bold">{pinned.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{pinned.body}</p>
        </section>
      )}
      <section className="grid grid-cols-2 gap-3">
        {surfaceNav.filter((item) => item.id !== "home").map((item) => (
          <Link
            key={item.id}
            to={item.href}
            className="rounded-xl border border-orange-100 bg-white p-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {item.label}
            <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">เปิดดู prototype</span>
          </Link>
        ))}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">ตัวอย่างฟีดล่าสุด</h2>
          <Link to="/community/feed" className="text-sm font-semibold text-orange-600">
            ดูทั้งหมด
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {posts.slice(0, 2).map((post) => (
            <PostCard key={post.id} post={post} compact />
          ))}
        </div>
      </section>
    </>
  );
}

function FeedSurface({ posts }: { posts: typeof COMMUNITY_PROTOTYPE_POSTS }) {
  return (
    <section className="space-y-3">
      <LockedAction title="สร้างโพสต์" detail="ยังไม่เปิดใช้งานใน prototype รอบนี้" />
      {posts.length === 0 ? <EmptyState label="ยังไม่มีโพสต์สำหรับ community นี้" /> : null}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </section>
  );
}

function GroupsSurface({
  groups,
  favoriteGroupIds,
  onToggleFavorite,
}: {
  groups: typeof COMMUNITY_PROTOTYPE_GROUPS;
  favoriteGroupIds: string[];
  onToggleFavorite: (groupId: string) => void;
}) {
  return (
    <section className="space-y-3">
      {groups.map((group) => {
        const isFavorite = favoriteGroupIds.includes(group.id);
        return (
          <article key={group.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <StatusPill
                  label={group.visibility === "private-group" ? "กลุ่มส่วนตัว" : "เห็นได้ในชุมชน"}
                  tone={group.visibility === "private-group" ? "slate" : "green"}
                />
                <h2 className="mt-3 text-lg font-bold">{group.name}</h2>
              </div>
              <button
                type="button"
                aria-pressed={isFavorite}
                onClick={() => onToggleFavorite(group.id)}
                className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                {isFavorite ? "ปักไว้แล้ว" : "ปักหมุด"}
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
            <p className="mt-3 text-sm text-slate-500">
              {group.memberCountLabel} · {group.nextActivityLabel}
            </p>
          </article>
        );
      })}
    </section>
  );
}

function EventsSurface({ events }: { events: typeof COMMUNITY_PROTOTYPE_EVENTS }) {
  return (
    <section className="space-y-3">
      {events.map((event) => (
        <article key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <StatusPill
            label={event.visibility === "private-group" ? "Private group" : "Member-only"}
            tone={event.visibility === "private-group" ? "slate" : "green"}
          />
          <h2 className="mt-3 text-lg font-bold">{event.title}</h2>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600">
            <InfoRow label="วันที่" value={event.dateLabel} />
            <InfoRow label="เวลา" value={event.timeLabel} />
            <InfoRow label="สถานที่" value={event.placeLabel} />
            <InfoRow label="ผู้จัด" value={event.organizerLabel} />
          </dl>
        </article>
      ))}
    </section>
  );
}

function HelpSurface({ requests }: { requests: typeof COMMUNITY_PROTOTYPE_HELP_REQUESTS }) {
  return (
    <section className="space-y-3">
      {requests.map((request) => (
        <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <StatusPill label={helpCategoryLabel(request.category)} tone="slate" />
            <StatusPill label={urgencyLabel(request.urgency)} tone={request.urgency === "high" ? "orange" : "green"} />
            <StatusPill label={helpStatusLabel(request.status)} tone="blue" />
          </div>
          <h2 className="mt-3 text-lg font-bold">{request.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{request.body}</p>
          <p className="mt-3 text-sm font-medium text-slate-700">{request.areaLabel}</p>
        </article>
      ))}
    </section>
  );
}

function MarketplaceSurface({ listings }: { listings: typeof COMMUNITY_PROTOTYPE_MARKETPLACE }) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
        ตลาดชุมชนนี้แยกจากระบบสั่งอาหาร ไม่มีตะกร้า ไม่มี QR payment และไม่มีการเรียก order contract
      </div>
      {listings.map((listing) => (
        <article key={listing.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <StatusPill label={marketCategoryLabel(listing.category)} tone="green" />
            <StatusPill label={marketStatusLabel(listing.status)} tone={listing.status === "active" ? "blue" : "slate"} />
          </div>
          <h2 className="mt-3 text-lg font-bold">{listing.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{listing.summary}</p>
          <p className="mt-3 text-sm font-semibold text-orange-700">{listing.priceLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{listing.ownerLabel}</p>
        </article>
      ))}
    </section>
  );
}

function MapSurface({ entries }: { entries: typeof COMMUNITY_PROTOTYPE_MAP_ENTRIES }) {
  const publicEntries = entries.filter((entry) => entry.layer === "public-directory");
  const privateEntries = entries.filter((entry) => entry.layer === "private-community-map");
  return (
    <section className="space-y-4">
      <MapLayer
        title="Public Directory"
        detail="แสดงเฉพาะสถานที่สาธารณะหรือ business/service ที่ opt-in/approved แล้ว"
        entries={publicEntries}
      />
      <MapLayer
        title="Private Community Map"
        detail="แสดงเฉพาะสมาชิก community เดียวกัน และไม่แสดงบ้านหรือพิกัดแม่นยำของสมาชิก"
        entries={privateEntries}
      />
    </section>
  );
}

function MapLayer({
  title,
  detail,
  entries,
}: {
  title: string;
  detail: string;
  entries: typeof COMMUNITY_PROTOTYPE_MAP_ENTRIES;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      <div className="mt-3 space-y-3">
        {entries.length === 0 ? <EmptyState label="ยังไม่มีรายการใน layer นี้" /> : null}
        {entries.map((entry) => (
          <article key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <h3 className="font-semibold">{entry.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{entry.category}</p>
            <p className="mt-2 text-sm text-slate-700">{entry.locationLabel}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{entry.precisionLabel}</p>
            <p className="mt-1 text-xs text-slate-500">{entry.visibilityNote}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PostCard({ post, compact = false }: { post: typeof COMMUNITY_PROTOTYPE_POSTS[number]; compact?: boolean }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <StatusPill label={postKindLabel(post.kind)} tone={post.kind === "safety" ? "orange" : "green"} />
        <StatusPill label="Member-only" tone="slate" />
      </div>
      <h2 className="mt-3 text-lg font-bold">{post.title}</h2>
      {!compact && <p className="mt-2 text-sm leading-6 text-slate-600">{post.body}</p>}
      <p className="mt-3 text-xs text-slate-500">
        {post.authorLabel} · {post.postedAtLabel}
      </p>
    </article>
  );
}

function LockedAction({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <button
        type="button"
        disabled
        className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500"
      >
        {title}ยังไม่เปิดใช้งาน
      </button>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
      {label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "orange" | "green" | "blue" | "slate" }) {
  const toneClass = {
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  }[tone];
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

function postKindLabel(kind: typeof COMMUNITY_PROTOTYPE_POSTS[number]["kind"]) {
  return {
    announcement: "ประกาศ",
    discussion: "พูดคุย",
    safety: "เตือนภัย",
  }[kind];
}

function helpCategoryLabel(category: typeof COMMUNITY_PROTOTYPE_HELP_REQUESTS[number]["category"]) {
  return {
    "neighbor-help": "ช่วยเพื่อนบ้าน",
    "lost-found": "ของหาย/พบของ",
    safety: "ความปลอดภัย",
    maintenance: "พื้นที่ส่วนกลาง",
  }[category];
}

function urgencyLabel(urgency: typeof COMMUNITY_PROTOTYPE_HELP_REQUESTS[number]["urgency"]) {
  return {
    low: "ด่วนต่ำ",
    medium: "ด่วนปานกลาง",
    high: "ด่วนสูง",
  }[urgency];
}

function helpStatusLabel(status: typeof COMMUNITY_PROTOTYPE_HELP_REQUESTS[number]["status"]) {
  return {
    open: "เปิดรับความช่วยเหลือ",
    "in-progress": "กำลังดำเนินการ",
    resolved: "แก้ไขแล้ว",
  }[status];
}

function marketCategoryLabel(category: typeof COMMUNITY_PROTOTYPE_MARKETPLACE[number]["category"]) {
  return {
    buy: "ต้องการซื้อ",
    sell: "ขาย",
    share: "แบ่งปัน/ยืม",
    free: "ฟรี",
  }[category];
}

function marketStatusLabel(status: typeof COMMUNITY_PROTOTYPE_MARKETPLACE[number]["status"]) {
  return {
    active: "ยังเปิดอยู่",
    reserved: "จองแล้ว",
    sold: "ปิดรายการแล้ว",
  }[status];
}
