import { createFileRoute } from "@tanstack/react-router";
import { PublicIncidentDetailView } from "@/components/community/PublicIncidentDetail";

export const Route = createFileRoute("/community/incidents/$incidentId")({
  component: PublicIncidentDetailRoute,
});

function PublicIncidentDetailRoute() {
  const { incidentId } = Route.useParams();
  return <PublicIncidentDetailView incidentId={incidentId} />;
}
