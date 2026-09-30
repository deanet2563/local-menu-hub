import type { ReactElement } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

type ShopOwnerTab = {
  to: "/" | "/sweet/shop" | "/sweet/menu" | "/sweet/orders" | "/account";
  label: string;
  icon: (active: boolean) => ReactElement;
};

function iconProps(active: boolean) {
  return {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: active ? "#0A7A38" : "#98A39B",
    strokeWidth: active ? 2.2 : 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
  };
}

const TABS: ShopOwnerTab[] = [
  {
    to: "/",
    label: "หน้าเว็บ",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10.5V20h12v-9.5" />
        <path d="M10 20v-5.5h4V20" />
      </svg>
    ),
  },
  {
    to: "/sweet/shop",
    label: "ร้านค้า",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M4 9h16" />
        <path d="M5 9v11h14V9" />
        <path d="M3.5 9 5 4h14l1.5 5" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    to: "/sweet/menu",
    label: "เมนู",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M7 3v5.2a2 2 0 0 0 4 0V3" />
        <path d="M9 8.2V21" />
        <path d="M17 3c-1.5 0-2.6 1.8-2.6 4s1.1 4 2.6 4 2.6-1.8 2.6-4-1.1-4-2.6-4Z" />
        <path d="M17 11V21" />
      </svg>
    ),
  },
  {
    to: "/sweet/orders",
    label: "ออเดอร์",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" />
        <path d="M9 8h6M9 12h6" />
      </svg>
    ),
  },
  {
    to: "/account",
    label: "บัญชี",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
      </svg>
    ),
  },
];

const SHOP_OWNER_PATHS = new Set([
  "/sweet/shop",
  "/sweet/menu",
  "/sweet/orders",
]);

export function ShopOwnerBottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!SHOP_OWNER_PATHS.has(pathname)) return null;

  return (
    <nav
      aria-label="เมนูเจ้าของร้าน"
      className="fixed inset-x-0 bottom-0 z-[80] mx-auto grid max-w-md grid-cols-5 border-t border-[#E3EAE4] bg-white/95 px-2 pt-1.5 shadow-[0_-8px_26px_rgba(11,81,36,0.08)] backdrop-blur-xl"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className="relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl py-1 text-[10.5px] font-semibold"
            style={{ color: active ? "#0A7A38" : "#98A39B" }}
          >
            {active && (
              <span
                className="absolute inset-x-2 top-0 h-9 rounded-2xl bg-[#E7F8EA]"
                aria-hidden="true"
              />
            )}
            <span className="relative">{tab.icon(active)}</span>
            <span className="relative">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
