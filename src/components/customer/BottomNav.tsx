import { Link, useRouterState } from "@tanstack/react-router";

// ============================================================
// MyTree — Modern customer bottom navigation.
// Approved 5-tab structure: Home / Food / Community / Map / Account.
// Renders ONLY on the exact customer destinations below so it never
// overlaps Cart's own fixed checkout bar, or appears on Shop/Rider/
// Sweet backoffice or debug routes.
// ============================================================

type NavTab = {
  to: "/" | "/hub" | "/community" | "/map" | "/account";
  label: string;
  icon: string;
};

const TABS: NavTab[] = [
  { to: "/", label: "หน้าแรก", icon: "🏠" },
  { to: "/hub", label: "อาหาร", icon: "🍜" },
  { to: "/community", label: "ชุมชน", icon: "🌳" },
  { to: "/map", label: "แผนที่", icon: "📍" },
  { to: "/account", label: "บัญชี", icon: "👤" },
];

const NAV_VISIBLE_PATHS = new Set<string>(TABS.map((t) => t.to));

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!NAV_VISIBLE_PATHS.has(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-gray-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
              active ? "text-orange-600" : "text-gray-400"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className={active ? "font-medium" : ""}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
