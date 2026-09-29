import { createFileRoute } from "@tanstack/react-router";
import { EmergencyNav } from "@/components/community/EmergencyNav";
import { CommunityIncidentReport } from "@/components/community/CommunityIncidentReport";

export const Route = createFileRoute("/community/report")({
  component: CommunityReportRoute,
});

function CommunityReportRoute() {
  return (
    <>
      <EmergencyNav />
      <CommunityIncidentReport />
    </>
  );
}

// Route intentionally relies on TanStack Router generation during build; routeTree.gen.ts is never hand-edited.
