import { createFileRoute } from "@tanstack/react-router";
import { EmergencyNav } from "@/components/community/EmergencyNav";
import { CommunityIncidentMap } from "@/components/community/CommunityIncidentMap";

export const Route = createFileRoute("/community/incidents")({
  component: CommunityIncidentsRoute,
});

function CommunityIncidentsRoute() {
  return (
    <>
      <EmergencyNav />
      <CommunityIncidentMap />
    </>
  );
}
