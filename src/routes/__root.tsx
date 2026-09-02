import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { completeLineSessionReturnIfReady } from "@/lib/supabase";

function RootLayout() {
  useEffect(() => {
    void completeLineSessionReturnIfReady();
  }, []);

  return <Outlet />;
}

export const Route = createRootRoute({
  component: RootLayout,
});
