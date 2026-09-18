import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getActiveCommunityFixturePreviewDecision } from "./lib/previewDebugRoute";
import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const communityPreviewDecision = getActiveCommunityFixturePreviewDecision();

if (communityPreviewDecision === "redirect-community") {
  window.location.replace("/community");
} else {
  if (communityPreviewDecision === "allow") {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    if (!robots.isConnected) document.head.append(robots);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
