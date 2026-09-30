import { useEffect } from "react";
import { createRootRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { BottomNav } from "@/components/customer/BottomNav";
import { ShopOwnerBottomNav } from "@/components/shop/ShopOwnerBottomNav";
import { getLiffStatePath } from "@/lib/supabase";

function ShopLiffStateRedirect() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const target = getLiffStatePath();
    if (!target || target === pathname) return;

    if (target === "/sweet/shop") {
      void navigate({ to: "/sweet/shop", replace: true });
      return;
    }
    if (target === "/sweet/menu") {
      void navigate({ to: "/sweet/menu", replace: true });
      return;
    }
    if (target === "/sweet/signup") {
      void navigate({ to: "/sweet/signup", replace: true });
    }
  }, [navigate, pathname]);

  return null;
}

export const Route = createRootRoute({
  component: () => (
    <>
      <ShopLiffStateRedirect />
      <Outlet />
      <BottomNav />
      <ShopOwnerBottomNav />
    </>
  ),
});
