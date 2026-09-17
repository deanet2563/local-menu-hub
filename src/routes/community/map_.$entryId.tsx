import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetail } from "@/components/community/CommunityDetail";

export const Route = createFileRoute("/community/map_/$entryId")({ component: MapDetailRoute });

function MapDetailRoute() {
  const { entryId } = Route.useParams();
  return <CommunityDetail kind="map" itemId={entryId} />;
}
