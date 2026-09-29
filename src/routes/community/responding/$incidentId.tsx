import { createFileRoute } from "@tanstack/react-router";
import { ReopenedIncidentView } from "@/components/community/ReopenedIncidentView";

export const Route = createFileRoute("/community/responding/$incidentId")({
  component: ResponderIncidentRoute,
});

function ResponderIncidentRoute() {
  const { incidentId } = Route.useParams();
  return <ReopenedIncidentView role="responder" incidentId={incidentId} />;
}
