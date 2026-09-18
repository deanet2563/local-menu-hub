import type { ReactElement } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

// ============================================================
// Community-lane-local copy of the approved global bottom nav.
//
// The canonical component lives at
// src/components/customer/BottomNav.tsx on branch
// codex/customer-nav-real-prod-base (Lane 1 — Customer Web App).
// Lane 4 (Community Phase 3) is developed on a separate branch/
// worktree and is not permitted to touch src/components/customer/*,
// so this file duplicates that component's visual design (same
// moss/ink colors, same icon shapes, same 5-tab structure) scoped
// under src/components/community/* instead of importing across
// worktrees.
//
// TEMP: the "แผนที่" tab below points at "/community/map" (a route
// that exists in this worktree) rather than the global "/map" used
// by the canonical BottomNav, because this worktree has no top-level
// /map route and TanStack Router's typed routing would fail the
// build otherwise. When Lane 4 merges into the main customer app,
// delete this file and use the canonical BottomNav (with its real
// "/map" target) instead — do not let this duplicate become the
// long-term source of truth.
// ============================================================

const MOSS = "#3f6b4a";
const MOSS_DEEP = "#28432f";
const INK_FAINT = "#a3a99c";

type NavTab = {
  to: "/" | "/hub" | "/community" | "/community/map" | "/account";
  label: string;
  isActive: (pathname: string) => boolean;
  icon: (props: { active: boolean }) => ReactElement;
};

function iconProps(active: boolean) {
  return {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: active ? MOSS : INK_FAINT,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "w-6 h-6",
  };
}

const TABS: NavTab[] = [
  {
    to: "/",
    label: "หน้าแรก",
    isActive: (pathname) => pathname === "/",
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10.5V20h12v-9.5" />
        <path d="M10 20v-5.5h4V20" />
      </svg>
    ),
  },
  {
    to: "/hub",
    label: "อาหาร",
    isActive: (pathname) => pathname === "/hub",
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <path d="M7 3v5.2a2 2 0 0 0 4 0V3" />
        <path d="M9 8.2V21" />
        <path d="M17 3c-1.5 0-2.6 1.8-2.6 4s1.1 4 2.6 4 2.6-1.8 2.6-4-1.1-4-2.6-4Z" />
        <path d="M17 11V21" />
      </svg>
    ),
  },
  {
    to: "/community",
    label: "ชุมชน",
    isActive: (pathname) => pathname === "/community" || pathname.startsWith("/community/"),
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="9" r="4.2" />
        <path d="M12 13.2c-4.5 0-7.5 2.4-7.5 5.3V20h15v-1.5c0-2.9-3-5.3-7.5-5.3Z" />
        <path d="M12 4.8V3M9.2 5.8 8 4.4M14.8 5.8 16 4.4" />
      </svg>
    ),
  },
  {
    to: "/community/map",
    label: "แผนที่",
    isActive: (pathname) => pathname === "/community/map" || pathname.startsWith("/community/map/"),
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" />
        <circle cx="12" cy="10" r="2.3" />
      </svg>
    ),
  },
  {
    to: "/account",
    label: "บัญชี",
    isActive: (pathname) => pathname === "/account",
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
      </svg>
    ),
  },
];

export function CommunityBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-gray-200 bg-white/95 backdrop-blur px-1.5 pt-2.5"
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {TABS.map((tab) => {
        const active = tab.isActive(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-1 py-1 text-[10.5px] font-semibold"
            style={{ color: active ? MOSS_DEEP : INK_FAINT }}
          >
            <Icon active={active} />
            <span>{tab.label}</span>
            <span
              className="h-1 w-1 rounded-full -mt-0.5"
              style={{ backgroundColor: MOSS, opacity: active ? 1 : 0 }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
