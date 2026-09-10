import { createRootRoute, Outlet } from "@tanstack/react-router";
import { CustomerBottomNav } from "@/components/customer/CustomerBottomNav";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <CustomerBottomNav />
    </>
  ),
});
