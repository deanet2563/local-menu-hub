import { createFileRoute } from "@tanstack/react-router";
import { EmergencyNav } from "@/components/community/EmergencyNav";
import { ReopenedIncidentView } from "@/components/community/ReopenedIncidentView";

export const Route = createFileRoute("/community/my-incidents/$incidentId")({
  component: ReporterIncidentRoute,
});

function ReporterIncidentRoute() {
  const { incidentId } = Route.useParams();
  return (
    <>
      <EmergencyNav />
      <ReopenedIncidentView role="reporter" incidentId={incidentId} />
    </>
  );
}
