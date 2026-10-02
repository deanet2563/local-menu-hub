import { createRootRoute, Link, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

const customerRoute = (pathname: string) => {
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const pathParts = normalizedPath.split("/").filter(Boolean);
  const customerShopDetail = pathParts.length === 2 && pathParts[0] === "shop" && pathParts[1] !== "orders";
  return ["/", "/hub", "/map", "/cart", "/orders", "/account"].includes(normalizedPath) || customerShopDetail;
};

function RootLayout() {
  const { pathname } = useLocation();
  const showCustomerNav = customerRoute(pathname);
  const normalizedPath = pathname.replace(/\/$/, "") || "/";

  return (
    <>
      <Outlet />
      {showCustomerNav && (
        <nav aria-label="เมนูลูกค้า" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="mx-auto grid max-w-xl grid-cols-5">
            <CustomerNavLink to="/" label="หน้าแรก" icon="⌂" active={normalizedPath === "/"} />
            <CustomerNavLink to="/hub" label="อาหาร" icon="🍽" active={normalizedPath === "/hub" || normalizedPath.startsWith("/shop/")} />
            <CustomerNavLink to="/map" label="แผนที่" icon="⌖" active={normalizedPath === "/map"} />
            <CustomerNavLink to="/orders" label="ออเดอร์" icon="▤" active={normalizedPath === "/orders"} />
            <CustomerNavLink to="/account" label="บัญชี" icon="●" active={normalizedPath === "/account"} />
          </div>
        </nav>
      )}
    </>
  );
}

function CustomerNavLink({ to, label, icon, active }: { to: "/" | "/hub" | "/map" | "/orders" | "/account"; label: string; icon: string; active: boolean }) {
  return (
    <Link to={to} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] ${active ? "font-semibold text-green-800" : "text-gray-500"}`}>
      <span aria-hidden="true" className="text-lg leading-5">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
