import type { ReactElement } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

// ============================================================
// MyTree — Modern customer bottom navigation.
// Phase-1 Local Food Hub: Home / Restaurants / Map / Orders / Account.
// Renders ONLY on the exact customer destinations below so it never
// overlaps Cart's own fixed checkout bar, or appears on Shop/Rider/
// Sweet backoffice or debug routes.
//
// Uses line-style SVG icons, MyTree green active states and large tap targets.
// ============================================================

const MOSS = "#10A53D";
const MOSS_DEEP = "#06752B";
const INK_FAINT = "#98A39B";

type NavTab = {
  to: "/" | "/hub" | "/map" | "/orders" | "/account";
  label: string;
  icon: (props: { active: boolean }) => ReactElement;
};

function iconProps(active: boolean) {
  return {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: active ? MOSS : INK_FAINT,
    strokeWidth: active ? 2.2 : 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "w-6 h-6",
  };
}

const TABS: NavTab[] = [
  {
    to: "/",
    label: "หน้าแรก",
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
    label: "ร้านอาหาร",
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
    to: "/map",
    label: "แผนที่",
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" />
        <circle cx="12" cy="10" r="2.3" />
      </svg>
    ),
  },
  {
    to: "/orders",
    label: "ออเดอร์",
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" />
        <path d="M9 8h6M9 12h6" />
      </svg>
    ),
  },
  {
    to: "/account",
    label: "บัญชี",
    icon: ({ active }) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
      </svg>
    ),
  },
];

const NAV_VISIBLE_PATHS = new Set<string>(TABS.map((t) => t.to));

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!NAV_VISIBLE_PATHS.has(pathname)) return null;

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto grid max-w-6xl grid-cols-5 border-t border-[#E4EAE5] bg-white/95 px-2 pt-1.5 shadow-[0_-8px_26px_rgba(11,81,36,0.08)] backdrop-blur-xl"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className="relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl py-1 text-[10.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EB681B]"
            style={{ color: active ? MOSS_DEEP : INK_FAINT }}
          >
            {active && <span className="absolute inset-x-2 top-0 h-9 rounded-2xl bg-[#E7F8EA]" aria-hidden="true" />}
            <span className="relative"><Icon active={active} /></span>
            <span className="relative">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
