import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { publicSupabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";
import { useCart } from "@/lib/cart";
import { SponsorCard } from "@/components/customer/SponsorCard";
import { PromoBanner } from "@/components/customer/PromoBanner";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { HOME_SPONSOR_CARDS, selectHomeSponsorCard } from "@/lib/homeSponsorCards";
import { HOME_PROMO_BANNER } from "@/lib/homePromoBanner";
import { CURRENT_COMMUNITY_NAME, HOME_COMMUNITY_EVENTS, HOME_COMMUNITY_POSTS } from "@/lib/homeCommunityPreviewFixture";

type QuickAccessTile = { key: string; label: string; icon: ReactNode; to?: "/hub" | "/community" | "/map" };

function LineIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">{children}</svg>;
}

const QUICK_ACCESS_TILES: QuickAccessTile[] = [
  { key: "food", label: "อาหาร", to: "/hub", icon: <LineIcon><path d="M4 11h16M6 11a6 6 0 0 1 12 0M12 5V3M4 15h16M7 15l1 5h8l1-5" /></LineIcon> },
  { key: "secondhand", label: "ตลาดมือสอง", to: "/community", icon: <LineIcon><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></LineIcon> },
  { key: "services", label: "ช่างและบริการ", icon: <LineIcon><path d="m14 7 3-3 3 3-3 3M13 8 5 16a2 2 0 1 0 3 3l8-8" /><path d="m5 5 4 4" /></LineIcon> },
  { key: "health", label: "สุขภาพ", icon: <LineIcon><path d="M12 21s-7-4.6-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.4-7 11-7 11Z" /><path d="M9 12h6M12 9v6" /></LineIcon> },
  { key: "education", label: "การศึกษา", icon: <LineIcon><path d="m3 8 9-4 9 4-9 4-9-4Z" /><path d="M7 10.2V16c2.8 2 7.2 2 10 0v-5.8M21 8v7" /></LineIcon> },
  { key: "beauty", label: "ความงาม", icon: <LineIcon><path d="M7 20h10M9 20l1-9h4l1 9M10 11V5a2 2 0 0 1 4 0v6" /><path d="M10 8h4" /></LineIcon> },
  { key: "events", label: "กิจกรรม", to: "/community", icon: <LineIcon><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="m9 15 2 2 4-4" /></LineIcon> },
  { key: "all", label: "ดูทั้งหมด", to: "/map", icon: <LineIcon><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></LineIcon> },
];

type NearbyShopRow = { shop_id: string; name: string; category: string | null; distance_km: number | string | null };
type NearbyState = "idle" | "loading" | "ready" | "error";
const NEARBY_LIMIT = 12;

function shopInitials(name: string): string { return name.trim().slice(0, 2).toUpperCase() || "?"; }
function ArrowIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>; }

export function HomeOverview() {
  const c = useCart();
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyShopRow[]>([]);
  const [nearbyState, setNearbyState] = useState<NearbyState>("idle");

  useEffect(() => { void loadNearby(); }, []);

  async function loadNearby() {
    setNearbyState("loading");
    try {
      const loc = await getCurrentLocation();
      const { data, error } = await publicSupabase.rpc("fn_shops_near_location", { p_lat: loc.lat, p_lng: loc.lng });
      if (error) throw error;
      setNearby(((data as NearbyShopRow[]) ?? []).slice(0, NEARBY_LIMIT));
      setNearbyState("ready");
    } catch { setNearbyState("error"); }
  }

  const topSponsor = selectHomeSponsorCard(HOME_SPONSOR_CARDS, "top");
  const midSponsor = selectHomeSponsorCard(HOME_SPONSOR_CARDS, "mid");

  return (
    <div className="min-h-screen bg-[#F7FAF5] pb-28 text-[#0A3B20]">
      <header className="relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-[#075B28] via-[#087A31] to-[#0A9638] px-5 pb-7 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] text-white shadow-[0_12px_32px_rgba(5,95,39,0.22)]">
        <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[#FF7417]/25" />
        <div className="absolute -bottom-12 left-8 h-28 w-28 rounded-full border-[20px] border-white/5" />
        <div className="relative flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold tracking-[0.18em] text-[#FFE1C7]">MYTREE COMMUNITY</p><h1 className="mt-1 text-[28px] font-black leading-tight tracking-tight">ทุกเรื่องใกล้บ้าน<br />อยู่ที่นี่</h1></div>
          <div className="relative h-20 w-20 shrink-0" aria-hidden="true"><span className="absolute inset-2 rounded-full bg-white/15 blur-lg" /><img src="/brand/mytree-logo.png" alt="" className="relative h-full w-full object-contain drop-shadow-[0_7px_8px_rgba(0,0,0,0.22)]" /></div>
        </div>
        <Link to="/map" className="relative mt-5 flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 text-[#28432F] shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[#FF7417]" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <span className="flex-1 text-sm text-[#657369]">ค้นหาร้านค้า บริการ หรือสิ่งที่ต้องการ</span><span className="rounded-full bg-[#FFF0E4] px-2.5 py-1 text-[10px] font-bold text-[#BB4B00]">ใกล้ฉัน</span>
        </Link>
      </header>

      <main className="space-y-6 px-4 pt-5">
        <section aria-labelledby="quick-access-title">
          <div className="mb-3 flex items-center justify-between"><h2 id="quick-access-title" className="text-lg font-extrabold">ค้นหาได้ทันที</h2><span className="text-xs font-medium text-[#738078]">ใกล้บ้านคุณ</span></div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 rounded-3xl bg-white px-2 py-5 shadow-[0_8px_28px_rgba(34,70,47,0.07)] ring-1 ring-[#E8ECE6]">
            {QUICK_ACCESS_TILES.map((tile, index) => {
              const content = <><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${index % 3 === 1 ? "bg-[#FFF0E4] text-[#D65300]" : "bg-[#E7F8EA] text-[#078433]"}`}>{tile.icon}</span><span className="mt-2 w-full truncate text-center text-[11px] font-semibold text-[#31513C]">{tile.label}</span></>;
              const className = "flex min-w-0 flex-col items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7417]";
              return tile.to ? <Link key={tile.key} to={tile.to} className={className}>{content}</Link> : <button key={tile.key} type="button" onClick={() => setComingSoonLabel(tile.label)} className={className}>{content}</button>;
            })}
          </div>
        </section>

        <PromoBanner emoji={HOME_PROMO_BANNER.emoji} title={HOME_PROMO_BANNER.title} subtitle={HOME_PROMO_BANNER.subtitle} ctaLabel={HOME_PROMO_BANNER.ctaLabel} />
        {topSponsor && <SponsorCard label={topSponsor.sponsorLabel} title={topSponsor.title} subtitle={topSponsor.subtitle} ctaLabel={topSponsor.ctaLabel} />}

        <section aria-labelledby="community-title">
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D65300]">เรื่องราวรอบตัว</p><h2 id="community-title" className="mt-0.5 text-lg font-extrabold">ชุมชนของคุณ</h2></div><Link to="/community" className="flex min-h-11 items-center gap-1 text-sm font-bold text-[#078433]">ดูทั้งหมด <ArrowIcon /></Link></div>
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#064B23] to-[#087A31] p-4 text-white shadow-[0_10px_26px_rgba(5,95,39,0.18)]">
            <div className="flex items-center gap-2 border-b border-white/15 pb-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">🏘️</span><div className="min-w-0"><p className="text-[10px] font-medium text-[#BFD5C5]">ชุมชนปัจจุบัน</p><p className="truncate text-sm font-bold">{CURRENT_COMMUNITY_NAME}</p></div></div>
            <div className="mt-3 grid gap-2">{HOME_COMMUNITY_EVENTS.slice(0, 2).map((evt) => <Link key={evt.id} to="/community" className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 transition-colors hover:bg-white/15"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF7417] text-sm font-black">{evt.whenLabel.slice(0, 2)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{evt.title}</span><span className="mt-0.5 block truncate text-[11px] text-[#D7E4DA]">{evt.whenLabel} · {evt.locationLabel}</span></span><ArrowIcon /></Link>)}</div>
          </div>
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{HOME_COMMUNITY_POSTS.slice(0, 3).map((post) => <Link key={post.id} to="/community" className="w-[82%] shrink-0 snap-start rounded-2xl border border-[#E5EAE4] bg-white p-4 shadow-[0_5px_16px_rgba(35,66,45,0.05)]"><div className="flex items-center gap-2 text-xs font-bold text-[#078433]"><span className="h-2 w-2 rounded-full bg-[#FF7417]" />{post.author}</div><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#55665B]">{post.excerpt}</p></Link>)}</div>
        </section>

        {midSponsor && <SponsorCard label={midSponsor.sponsorLabel} title={midSponsor.title} subtitle={midSponsor.subtitle} ctaLabel={midSponsor.ctaLabel} />}

        <section aria-labelledby="nearby-title">
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D65300]">เดินทางไม่นาน</p><h2 id="nearby-title" className="mt-0.5 text-lg font-extrabold">ใกล้คุณตอนนี้</h2></div>{nearbyState === "ready" && <span className="rounded-full bg-[#E7F8EA] px-2.5 py-1 text-[10px] font-bold text-[#078433]">เรียงตามระยะทาง</span>}</div>
          {nearbyState === "loading" && <div className="rounded-2xl bg-white p-5 text-center text-sm text-[#7B887F]">กำลังค้นหาร้านใกล้คุณ...</div>}
          {nearbyState === "error" && <div className="rounded-2xl border border-[#FFD0AD] bg-[#FFF7F0] p-4"><p className="text-sm font-semibold text-[#8A3D0B]">เปิดตำแหน่งเพื่อดูร้านที่ใกล้ที่สุด</p><button type="button" onClick={() => void loadNearby()} className="mt-2 min-h-11 rounded-xl bg-[#FF7417] px-4 text-sm font-bold text-white">ลองอีกครั้ง</button></div>}
          {nearbyState === "ready" && <div className="space-y-2">{nearby.map((s) => { const km = s.distance_km == null ? null : Number(s.distance_km); return <Link key={s.shop_id} to="/shop/$shopId" params={{ shopId: s.shop_id }} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-[#E5EAE4] bg-white p-2.5 shadow-[0_4px_14px_rgba(35,66,45,0.04)]"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFF1E2] to-[#F8D5AE] text-sm font-black text-[#B65B11]">{shopInitials(s.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#263F31]">{s.name}</p><p className="mt-0.5 truncate text-xs text-[#839087]">{s.category || "ร้านค้าใกล้บ้าน"}</p></div><span className="shrink-0 rounded-full bg-[#EEF5ED] px-2.5 py-1 text-[11px] font-bold text-[#34704A]">{km != null && !Number.isNaN(km) ? `${km.toFixed(1)} กม.` : "ใกล้คุณ"}</span></Link>; })}{nearby.length === 0 && <div className="rounded-2xl bg-white py-8 text-center text-sm text-[#839087]">ยังไม่พบร้านใกล้คุณ</div>}</div>}
        </section>
      </main>

      <FloatingCartBar cart={c} />
      {comingSoonLabel && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#062614]/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" onClick={() => setComingSoonLabel(null)}><div className="w-full max-w-sm rounded-[28px] bg-white p-5 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0E4] text-2xl">🌱</span><p className="mt-3 text-lg font-extrabold text-[#0A3B20]">{comingSoonLabel}</p><p className="mt-1 text-sm text-[#77857C]">กำลังเตรียมพื้นที่นี้ให้พร้อมใช้งาน</p><button type="button" onClick={() => setComingSoonLabel(null)} className="mt-5 min-h-12 w-full rounded-2xl bg-[#087A31] text-sm font-bold text-white">รับทราบ</button></div></div>}
    </div>
  );
}
