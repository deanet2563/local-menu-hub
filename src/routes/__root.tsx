import { createRootRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/customer/BottomNav";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <BottomNav />
    </>
  ),
});
