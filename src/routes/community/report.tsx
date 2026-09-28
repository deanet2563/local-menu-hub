import { createFileRoute } from "@tanstack/react-router";
import { CommunityIncidentReport } from "@/components/community/CommunityIncidentReport";

export const Route = createFileRoute("/community/report")({
  component: CommunityIncidentReport,
});

// Route intentionally relies on TanStack Router generation during build; routeTree.gen.ts is never hand-edited.
