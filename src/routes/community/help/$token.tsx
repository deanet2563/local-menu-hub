import { createFileRoute } from "@tanstack/react-router";
import { SharedIncidentView } from "@/components/community/SharedIncidentView";

export const Route = createFileRoute("/community/help/$token")({
  component: SharedIncidentRoute,
});

function SharedIncidentRoute() {
  const { token } = Route.useParams();
  return <SharedIncidentView token={token} />;
}
