import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  COMMUNITY_PROTOTYPE_COMMUNITIES,
  getCommunityPrototypeCommunity,
  type CommunityPrototypeSurface,
} from "@/lib/communityPrototype";

const COMMUNITY_NAV: { id: CommunityPrototypeSurface; label: string; href: string }[] = [
  { id: "home", label: "หน้าแรก", href: "/community" },
  { id: "feed", label: "ฟีด", href: "/community/feed" },
  { id: "groups", label: "กลุ่ม", href: "/community/groups" },
  { id: "events", label: "กิจกรรม", href: "/community/events" },
  { id: "help", label: "ช่วยเหลือ", href: "/community/help" },
  { id: "marketplace", label: "ตลาดชุมชน", href: "/community/marketplace" },
  { id: "map", label: "แผนที่", href: "/community/map" },
];

export const COMMUNITY_NAV_ITEMS = COMMUNITY_NAV;

export function CommunityShell({
  surface,
  communityId,
  onCommunityChange,
  children,
}: {
  surface: CommunityPrototypeSurface;
  communityId: string;
  onCommunityChange: (communityId: string) => void;
  children: ReactNode;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const activeCommunity = getCommunityPrototypeCommunity(communityId);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: window.scrollX, behavior: "auto" });
  }, [surface]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>("[data-community-nav-active='true']");
    if (!nav || !active) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const edgePadding = 16;
    if (activeRect.left < navRect.left + edgePadding) {
      nav.scrollLeft -= navRect.left + edgePadding - activeRect.left;
    } else if (activeRect.right > navRect.right - edgePadding) {
      nav.scrollLeft += activeRect.right - navRect.right + edgePadding;
    }
  }, [surface]);

  return (
    <div className="min-h-screen bg-[#f7f5ef] pb-20 text-slate-950">
      <a
        href="#community-main"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <header className="border-b border-orange-100 bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
            หน้าทดลอง Community - ข้อมูลทั้งหมดเป็นตัวอย่างและไม่มีการบันทึกข้อมูลจริง
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600" htmlFor="community-switcher">เลือกวงชุมชน</label>
            <select
              id="community-switcher"
              value={communityId}
              onChange={(event) => onCommunityChange(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-orange-200 bg-white px-3 py-2 text-base font-semibold text-slate-900 shadow-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              {COMMUNITY_PROTOTYPE_COMMUNITIES.map((community) => (
                <option key={community.id} value={community.id}>{community.name} - {community.relationshipLabel}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-orange-700">{activeCommunity.relationshipLabel}</p>
            <h1 className="mt-1 break-words text-pretty text-2xl font-bold leading-tight">{activeCommunity.name}</h1>
            <p className="mt-2 break-words text-pretty text-sm leading-6 text-slate-600">
              {activeCommunity.boundaryLabel} · {activeCommunity.memberSummary}
            </p>
          </div>
          <nav ref={navRef} aria-label="เมนู Community" className="-mx-4 flex max-w-[100vw] gap-2 overflow-x-auto px-4 pb-1">
            {COMMUNITY_NAV.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                activeOptions={{ exact: true }}
                aria-current={surface === item.id ? "page" : undefined}
                data-community-nav-active={surface === item.id ? "true" : undefined}
                className={`min-h-11 shrink-0 rounded-full border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-300 ${surface === item.id ? "border-orange-500 bg-orange-500 text-white" : "border-orange-100 bg-white text-slate-700"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="community-main" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-3 px-4 py-3 outline-none sm:space-y-4 sm:py-4">
        {children}
      </main>
    </div>
  );
}
