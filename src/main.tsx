import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initLiff, isPlatformAdminRoute } from "./lib/supabase";
import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function hasLiffState(): boolean {
  return new URLSearchParams(window.location.search).has("liff.state");
}

async function bootstrap() {
  // LIFF primary redirects carry liff.state. LINE requires liff.init() to
  // finish before any SPA router/history mutation; the SDK then performs the
  // secondary redirect that restores the requested path.
  const initializingLiffDeepLink = hasLiffState();

  // Initialize Platform Admin LIFF before mounting the router for both direct
  // MyTree admin URLs and LIFF primary/secondary redirects. This prevents the
  // router from briefly rendering customer surfaces and avoids redirect loops.
  if (isPlatformAdminRoute() || initializingLiffDeepLink) {
    try {
      await initLiff();
    } catch (error) {
      const root = document.getElementById("root");
      if (root) {
        root.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif"><div style="max-width:520px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">ไม่สามารถเปิด MyTree Head Office ได้</h1><p style="color:#6b7280;margin:0">กรุณาตรวจสอบการตั้งค่า Platform Admin LIFF แล้วลองอีกครั้ง</p></div></div>`;
      }
      console.error("LIFF bootstrap failed", error);
      return;
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

void bootstrap();
