import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import {
  getCustomerCanonicalOriginRedirect,
  getCustomerLiffStateDestination,
  initLiff,
  isPlatformAdminRoute,
} from "./lib/supabase";
import "./index.css";

type AppRouter = ReturnType<typeof createRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

async function bootstrap() {
  const platformAdminRoute = isPlatformAdminRoute();
  if (!platformAdminRoute) {
    const canonicalRedirect = getCustomerCanonicalOriginRedirect();
    if (canonicalRedirect) {
      window.location.replace(canonicalRedirect);
      return;
    }

    const customerLiffDestination = getCustomerLiffStateDestination();
    if (customerLiffDestination) {
      const destinationPath = new URL(customerLiffDestination, window.location.origin).pathname
        .replace(/\/+$/, "") || "/";
      if (destinationPath === "/map") {
        // The public map must remain anonymous even when opened from a Customer
        // LIFF deep link. Restore its requested URL without initializing LIFF.
        window.history.replaceState(window.history.state, "", customerLiffDestination);
      } else {
        // LIFF consumes liff.state and performs the secondary redirect. Do this
        // before importing/mounting the router so Home cannot flash first.
        const retryUrl = window.location.href;
        try {
          await initLiff();
        } catch (error) {
          renderCustomerLiffBootstrapError(retryUrl);
          console.error(
            "Customer LIFF bootstrap failed",
            error instanceof Error ? error.name : "unknown_error",
          );
          return;
        }
      }
    }
  }

  // Initialize Platform Admin LIFF before mounting the router for both direct
  // MyTree admin URLs and LIFF primary/secondary redirects. This prevents the
  // router from briefly rendering customer surfaces and avoids redirect loops.
  if (platformAdminRoute) {
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

  const { routeTree } = await import("./routeTree.gen");
  const router = createRouter({ routeTree });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

function renderCustomerLiffBootstrapError(retryUrl: string) {
  const root = document.getElementById("root");
  if (!root) return;

  const main = document.createElement("main");
  main.setAttribute("role", "alert");
  main.setAttribute("aria-live", "polite");
  main.style.cssText = "min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#f9fafb";

  const content = document.createElement("div");
  content.style.cssText = "max-width:480px;text-align:center";

  const heading = document.createElement("h1");
  heading.textContent = "เปิด MyTree ไม่สำเร็จ";
  heading.style.cssText = "font-size:22px;font-weight:700;margin:0 0 8px;color:#111827";

  const message = document.createElement("p");
  message.textContent = "เริ่มต้นการเชื่อมต่อ LINE ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
  message.style.cssText = "color:#4b5563;line-height:1.6;margin:0 0 20px";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "ลองอีกครั้ง";
  retry.style.cssText = "min-height:44px;border:0;border-radius:12px;background:#15803d;color:white;font-weight:600;padding:0 20px;cursor:pointer";
  retry.addEventListener("click", () => window.location.replace(retryUrl));

  content.append(heading, message, retry);
  main.append(content);
  root.replaceChildren(main);
}

void bootstrap();
