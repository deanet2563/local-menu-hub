import { Outlet, createFileRoute } from "@tanstack/react-router";
import { EmergencyNav } from "@/components/community/EmergencyNav";

export const Route = createFileRoute("/community/incidents")({
  component: CommunityIncidentsLayout,
});

function CommunityIncidentsLayout() {
  return (
    <>
      <EmergencyNav />
      <Outlet />
    </>
  );
}
