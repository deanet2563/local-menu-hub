import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

type NavItem = {
  to: "/" | "/food" | "/community" | "/map" | "/account";
  label: string;
  match: (pathname: string) => boolean;
  icon: (active: boolean) => ReactNode;
};

function IconShell({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={`relative grid h-8 w-12 place-items-center rounded-full transition-colors ${active ? "bg-emerald-50" : ""}`}>
      {children}
    </span>
  );
}

function HomeIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 10 9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    </IconShell>
  );
}

function FoodIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10h16" />
        <path d="M6 10a6 6 0 0 0 12 0" />
        <path d="M6 10a6 6 0 0 1 12 0" />
        <path d="M12 4v3" />
      </svg>
    </IconShell>
  );
}

function CommunityIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    </IconShell>
  );
}

function MapIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </svg>
    </IconShell>
  );
}

function AccountIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    </IconShell>
  );
}

export const CUSTOMER_BOTTOM_NAV_DESTINATIONS = ["หน้าแรก", "อาหาร", "ชุมชน", "แผนที่", "บัญชี"] as const;

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: CUSTOMER_BOTTOM_NAV_DESTINATIONS[0], match: (pathname) => pathname === "/", icon: HomeIcon },
  { to: "/food", label: CUSTOMER_BOTTOM_NAV_DESTINATIONS[1], match: (pathname) => pathname.startsWith("/food") || pathname.startsWith("/shop"), icon: FoodIcon },
  { to: "/community", label: CUSTOMER_BOTTOM_NAV_DESTINATIONS[2], match: (pathname) => pathname.startsWith("/community"), icon: CommunityIcon },
  { to: "/map", label: CUSTOMER_BOTTOM_NAV_DESTINATIONS[3], match: (pathname) => pathname.startsWith("/map"), icon: MapIcon },
  { to: "/account", label: CUSTOMER_BOTTOM_NAV_DESTINATIONS[4], match: (pathname) => pathname.startsWith("/account"), icon: AccountIcon },
];

export function shouldShowCustomerBottomNav(pathname: string): boolean {
  return pathname === "/"
    || pathname.startsWith("/food")
    || pathname.startsWith("/shop")
    || pathname.startsWith("/cart")
    || pathname.startsWith("/orders")
    || pathname.startsWith("/community")
    || pathname.startsWith("/map")
    || pathname.startsWith("/favorites")
    || pathname.startsWith("/notifications")
    || pathname.startsWith("/account");
}

export function CustomerBottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (!shouldShowCustomerBottomNav(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.06)]" aria-label="เมนูหลัก">
      <div className="mx-auto grid h-[var(--customer-bottom-nav-height)] max-w-md grid-cols-5 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={`${item.to}-${item.label}`}
              to={item.to}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs transition-colors ${active ? "font-semibold text-emerald-700" : "font-medium text-slate-500 active:text-slate-700"}`}
            >
              {item.icon(active)}
              <span className="text-[12px] leading-4">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
