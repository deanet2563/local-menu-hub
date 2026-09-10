import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cartCount, useCart } from "@/lib/cart";

type NavItem = {
  to: "/" | "/cart" | "/orders" | "/account";
  label: string;
  match: (pathname: string) => boolean;
  icon: (active: boolean) => ReactNode;
};

function IconShell({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={`relative grid h-8 w-12 place-items-center rounded-full transition-colors ${active ? "bg-orange-50" : ""}`}>
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

function SearchIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </IconShell>
  );
}

function CartIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6h15l-2 8H8L6 6Z" />
        <path d="M6 6 5 3H2" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
    </IconShell>
  );
}

function OrdersIcon(active: boolean) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3h8l2 3v15H6V6l2-3Z" />
        <path d="M9 10h6" />
        <path d="M9 14h6" />
        <path d="M9 18h4" />
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

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "หน้าแรก", match: (pathname) => pathname === "/", icon: HomeIcon },
  { to: "/", label: "ค้นหา", match: () => false, icon: SearchIcon },
  { to: "/cart", label: "ตะกร้า", match: (pathname) => pathname.startsWith("/cart"), icon: CartIcon },
  { to: "/orders", label: "ออเดอร์", match: (pathname) => pathname.startsWith("/orders"), icon: OrdersIcon },
  { to: "/account", label: "บัญชี", match: (pathname) => pathname.startsWith("/account"), icon: AccountIcon },
];

export function shouldShowCustomerBottomNav(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/cart") || pathname.startsWith("/orders") || pathname.startsWith("/account");
}

export function CustomerBottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const cart = useCart();
  const count = cartCount(cart);
  if (!shouldShowCustomerBottomNav(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur" aria-label="เมนูหลัก">
      <div className="mx-auto grid h-[76px] max-w-md grid-cols-5 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const badge = item.to === "/cart" && count > 0 ? (count > 9 ? "9+" : String(count)) : null;
          return (
            <Link
              key={`${item.to}-${item.label}`}
              to={item.to}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs transition-colors ${active ? "font-bold text-orange-600" : "font-medium text-slate-500 active:text-slate-700"}`}
            >
              <span className="relative">
                {item.icon(active)}
                {badge && <span className="absolute right-0 top-0 grid h-5 min-w-5 translate-x-1 -translate-y-1 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">{badge}</span>}
              </span>
              <span className="text-[12px] leading-4">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
