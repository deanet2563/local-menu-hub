import { createFileRoute } from "@tanstack/react-router";
import { ReopenedIncidentView } from "@/components/community/ReopenedIncidentView";

export const Route = createFileRoute("/community/my-incidents/$incidentId")({
  component: ReporterIncidentRoute,
});

function ReporterIncidentRoute() {
  const { incidentId } = Route.useParams();
  return <ReopenedIncidentView role="reporter" incidentId={incidentId} />;
}
