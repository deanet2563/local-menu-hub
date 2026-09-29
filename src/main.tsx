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

function restoreLiffStateRoute() {
  const raw = new URLSearchParams(window.location.search).get("liff.state");
  if (!raw) return;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* keep URLSearchParams-decoded value */ }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return;
  try {
    const target = new URL(decoded, window.location.origin);
    if (target.origin !== window.location.origin) return;
    const next = `${target.pathname}${target.search}${target.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(window.history.state, "", next);
  } catch {
    // Invalid LIFF state is ignored rather than navigating outside the app.
  }
}

async function bootstrap() {
  // LIFF deep links arrive at the configured Endpoint URL with liff.state.
  // Restore the requested in-app route before TanStack Router mounts so the
  // user never flashes through the home/production-looking surface first.
  restoreLiffStateRoute();
  // Initialize Platform Admin LIFF before mounting the router for both direct
  // MyTree admin URLs and LIFF primary/secondary redirects. This prevents the
  // router from briefly rendering customer surfaces and avoids redirect loops.
  if (isPlatformAdminRoute()) {
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
