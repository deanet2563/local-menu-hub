import { createFileRoute } from "@tanstack/react-router";
import { EmergencyNav } from "@/components/community/EmergencyNav";
import { ReopenedIncidentView } from "@/components/community/ReopenedIncidentView";

export const Route = createFileRoute("/community/responding/$incidentId")({
  component: ResponderIncidentRoute,
});

function ResponderIncidentRoute() {
  const { incidentId } = Route.useParams();
  return (
    <>
      <EmergencyNav />
      <ReopenedIncidentView role="responder" incidentId={incidentId} />
    </>
  );
}
