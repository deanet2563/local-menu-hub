import { Link } from "@tanstack/react-router";
import { CommunityBottomNav } from "@/components/community/CommunityBottomNav";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  COMMUNITY_PROTOTYPE_COMMUNITIES,
  COMMUNITY_NAV_ITEMS,
  COMMUNITY_PREVIEW_BANNER,
  getCommunityPrototypeCommunity,
  type CommunityPrototypeSurface,
} from "@/lib/communityPrototype";

export function CommunityShell({
  surface,
  communityId,
  onCommunityChange,
  showCreatePostAction = false,
  children,
}: {
  surface: CommunityPrototypeSurface;
  communityId: string;
  onCommunityChange: (communityId: string) => void;
  showCreatePostAction?: boolean;
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
    <div className="min-h-screen bg-cream pb-20 font-community text-ink">
      <a
        href="#community-main"
        className="fixed left-3 top-3 z-50 inline-flex min-h-11 -translate-y-20 items-center rounded-lg bg-moss-deep px-4 py-3 text-sm font-semibold text-white focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-clay"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <header className="border-b border-[#e7e4dc] bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:py-4">
          <div className="rounded-lg border border-clay-soft bg-clay-soft px-3 py-2 text-sm leading-6 text-clay-deep">
            {COMMUNITY_PREVIEW_BANNER}
          </div>
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-moss">{activeCommunity.relationshipLabel}</p>
              <div className="mt-1 flex min-w-0 items-start gap-2">
                <h1 className="min-w-0 flex-1 break-words text-pretty text-xl font-extrabold leading-tight sm:text-2xl">{activeCommunity.name}</h1>
                <div className="w-28 min-w-0 shrink-0 sm:w-40">
                  <label className="sr-only" htmlFor="community-switcher">เลือกวงชุมชน</label>
                  <select
                    id="community-switcher"
                    aria-label="เลือกวงชุมชน"
                    value={communityId}
                    onChange={(event) => onCommunityChange(event.target.value)}
                    className="min-h-11 w-full min-w-0 truncate rounded-lg border border-[#e7e4dc] bg-white px-2 py-2 text-xs font-semibold text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss-soft sm:px-3 sm:text-sm"
                  >
                    {COMMUNITY_PROTOTYPE_COMMUNITIES.map((community) => (
                      <option key={community.id} value={community.id}>{community.name} - {community.relationshipLabel}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {showCreatePostAction ? (
              <>
                <button
                  type="button"
                  disabled
                  aria-label="สร้างโพสต์ — ยังไม่เปิดใช้งาน"
                  aria-describedby="community-create-post-status"
                  title="สร้างโพสต์ — ยังไม่เปิดใช้งาน"
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#e7e4dc] bg-white text-lg text-ink-faint disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span aria-hidden="true">✏️</span>
                </button>
                <span id="community-create-post-status" className="sr-only">การสร้างโพสต์ยังไม่เปิดใช้งานในหน้าทดลอง</span>
              </>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="break-words text-pretty text-xs leading-5 text-ink-soft sm:text-sm sm:leading-6">
              {activeCommunity.boundaryLabel} · {activeCommunity.memberSummary}
            </p>
          </div>
          <nav ref={navRef} aria-label="เมนู Community" className="community-nav-scrollbar -mx-4 flex max-w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1">
            {COMMUNITY_NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                activeOptions={{ exact: true }}
                aria-current={surface === item.id ? "page" : undefined}
                data-community-nav-active={surface === item.id ? "true" : undefined}
                className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-clay ${surface === item.id ? "border-moss bg-moss text-white" : "border-[#e7e4dc] bg-white text-ink-soft hover:bg-moss-soft"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="community-main" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 outline-none">
        {children}
      </main>
      <CommunityBottomNav />
    </div>
  );
}
