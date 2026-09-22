import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { publicSupabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";
import { useCart } from "@/lib/cart";
import { SponsorCard } from "@/components/customer/SponsorCard";
import { PromoBanner } from "@/components/customer/PromoBanner";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { HOME_SPONSOR_CARDS, selectHomeSponsorCard } from "@/lib/homeSponsorCards";
import { HOME_PROMO_BANNER } from "@/lib/homePromoBanner";
import { HOME_COMMUNITY_EVENTS, HOME_COMMUNITY_POSTS } from "@/lib/homeCommunityPreviewFixture";

// ============================================================
// MyTree — Home (`/`) overview. Approved page split: Home is the
// general local-hub landing page (quick-access categories, sponsor
// slots, a short community preview, a mixed "nearby now" list);
// food-only browsing lives at /hub (FoodHub.tsx). Kept as its own
// component, not a reuse of HubHome.tsx or FoodHub.tsx.
//
// No min-h-screen on the wrapper — that inflated page height past
// the visible viewport on mobile in-app WebViews (LINE included) and
// pushed BottomNav off-screen on Food Hub; same class, same bug here.
// ============================================================

type QuickAccessTile = { key: string; label: string; icon: string; to?: "/hub" };

const QUICK_ACCESS_TILES: QuickAccessTile[] = [
  { key: "food", label: "อาหาร", icon: "🍜", to: "/hub" },
  { key: "secondhand", label: "ตลาดมือสอง", icon: "🛍️" },
  { key: "services", label: "ช่าง-บริการ", icon: "🛠️" },
  { key: "health", label: "สุขภาพ", icon: "🏥" },
  { key: "education", label: "การศึกษา", icon: "📚" },
  { key: "beauty", label: "ความงาม", icon: "💅" },
  { key: "events", label: "กิจกรรม", icon: "🎉" },
  { key: "all", label: "ทั้งหมด", icon: "🗂️" },
];

type NearbyShopRow = { shop_id: string; name: string; category: string | null; distance_km: number | string | null };
type NearbyState = "idle" | "loading" | "ready" | "error";

// fn_shops_near_location(p_lat, p_lng) รับแค่พิกัด ไม่มี parameter limit
// และคืนร้านที่เปิด/อนุมัติแล้วทั้งหมด เรียงตามระยะทางใกล้→ไกล
// ตัดจำนวนฝั่ง client จึงเป็นทางที่กระทบน้อยสุด (Home เป็นหน้ารวม
// ไม่ใช่หน้าค้นหา — เกิน 12 ร้านให้ไปต่อที่ lane ของหมวดนั้น).
const NEARBY_LIMIT = 12;

function shopInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function HomeOverview() {
  const c = useCart();
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyShopRow[]>([]);
  const [nearbyState, setNearbyState] = useState<NearbyState>("idle");

  useEffect(() => {
    void loadNearby();
  }, []);

  async function loadNearby() {
    setNearbyState("loading");
    try {
      const loc = await getCurrentLocation();
      const { data, error } = await publicSupabase.rpc("fn_shops_near_location", { p_lat: loc.lat, p_lng: loc.lng });
      if (error) throw error;
      setNearby(((data as NearbyShopRow[]) ?? []).slice(0, NEARBY_LIMIT));
      setNearbyState("ready");
    } catch {
      setNearbyState("error");
    }
  }

  const topSponsor = selectHomeSponsorCard(HOME_SPONSOR_CARDS, "top");
  const midSponsor = selectHomeSponsorCard(HOME_SPONSOR_CARDS, "mid");

  return (
    <div className="pb-24 bg-[#e6ede4]/40">
      <div className="p-4 space-y-3 bg-white">
        <div>
          <h1 className="text-xl font-bold text-[#28432f]">MyTree 🌳</h1>
          <p className="text-xs text-gray-500">แหล่งรวมร้านค้าและบริการใกล้บ้านคุณ</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACCESS_TILES.map((tile) => {
            const tileClass =
              "flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium bg-white border border-gray-200 text-[#28432f]";
            if (tile.to) {
              return (
                <Link key={tile.key} to={tile.to} className={tileClass}>
                  <span className="text-lg leading-none">{tile.icon}</span>
                  <span className="truncate">{tile.label}</span>
                </Link>
              );
            }
            return (
              <button type="button" key={tile.key} onClick={() => setComingSoonLabel(tile.label)} className={tileClass}>
                <span className="text-lg leading-none">{tile.icon}</span>
                <span className="truncate">{tile.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3">
        <PromoBanner
          emoji={HOME_PROMO_BANNER.emoji}
          title={HOME_PROMO_BANNER.title}
          subtitle={HOME_PROMO_BANNER.subtitle}
          ctaLabel={HOME_PROMO_BANNER.ctaLabel}
        />
      </div>

      {topSponsor && (
        <div className="pt-3">
          <SponsorCard label={topSponsor.sponsorLabel} title={topSponsor.title} subtitle={topSponsor.subtitle} ctaLabel={topSponsor.ctaLabel} />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#28432f]">ชุมชน</h2>
          <Link to="/community" className="text-xs text-[#3f6b4a]">
            ดูทั้งหมด
          </Link>
        </div>

        <div className="space-y-2">
          {HOME_COMMUNITY_EVENTS.slice(0, 2).map((evt) => (
            <div key={evt.id} className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-sm font-medium truncate">{evt.title}</p>
              <p className="text-xs text-gray-400">{evt.whenLabel} · {evt.locationLabel}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {HOME_COMMUNITY_POSTS.slice(0, 3).map((post) => (
            <div key={post.id} className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs font-medium text-[#28432f]">{post.author}</p>
              <p className="text-sm text-gray-600 truncate">{post.excerpt}</p>
            </div>
          ))}
        </div>
      </div>

      {midSponsor && <SponsorCard label={midSponsor.sponsorLabel} title={midSponsor.title} subtitle={midSponsor.subtitle} ctaLabel={midSponsor.ctaLabel} />}

      <div className="p-4 space-y-3">
        <h2 className="text-sm font-bold text-[#28432f]">ใกล้คุณตอนนี้</h2>

        {nearbyState === "loading" && <p className="text-sm text-gray-400 py-2">กำลังค้นหาร้านใกล้คุณ...</p>}

        {nearbyState === "error" && (
          <div className="py-2 space-y-1">
            <p className="text-sm text-gray-400">เปิดสิทธิ์ตำแหน่งเพื่อดูร้านใกล้คุณ</p>
            <button type="button" onClick={() => void loadNearby()} className="text-xs text-[#3f6b4a]">
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {nearbyState === "ready" && (
          <div className="space-y-2">
            {nearby.map((s) => {
              const km = s.distance_km == null ? null : Number(s.distance_km);
              return (
                <Link
                  key={s.shop_id}
                  to="/shop/$shopId"
                  params={{ shopId: s.shop_id }}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2"
                >
                  <div className="w-12 h-12 shrink-0 rounded-lg bg-[#faeadb] flex items-center justify-center text-sm font-bold text-[#a85f2c]">
                    {shopInitials(s.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.category}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-[#3f6b4a]">
                    {km != null && !Number.isNaN(km) ? `${km.toFixed(1)} กม.` : "ไม่ระบุระยะทาง"}
                  </span>
                </Link>
              );
            })}
            {nearby.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">ไม่พบร้านใกล้คุณ</p>}
          </div>
        )}
      </div>

      <FloatingCartBar cart={c} />

      {comingSoonLabel && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setComingSoonLabel(null)}
        >
          <div
            className="m-4 w-full max-w-xs rounded-2xl bg-white p-4 text-center space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-[#28432f]">{comingSoonLabel}</p>
            <p className="text-xs text-gray-500">เร็วๆนี้</p>
            <button
              type="button"
              onClick={() => setComingSoonLabel(null)}
              className="mt-1 rounded-lg bg-[#3f6b4a] text-white text-sm px-4 py-1.5"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
