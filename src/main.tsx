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

async function bootstrap() {
  // A LIFF permanent URL first lands on the endpoint root with `liff.state`.
  // Initialize the dedicated admin LIFF before mounting the router so LIFF can
  // complete its secondary redirect to /head-office or the legacy admin path.
  if (isPlatformAdminRoute() && new URLSearchParams(window.location.search).has("liff.state")) {
    try {
      await initLiff();
    } catch (error) {
      const root = document.getElementById("root");
      if (root) {
        root.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif"><div style="max-width:520px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">ไม่สามารถเปิด MyTree Head Office ได้</h1><p style="color:#6b7280;margin:0">กรุณาตรวจสอบการตั้งค่า Platform Admin LIFF แล้วลองอีกครั้ง</p></div></div>`;
      }
      console.error("Platform Admin LIFF bootstrap failed", error);
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
