import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetailRoute as CommunityLazyRoute } from "@/components/community/CommunityLazyRoute";

export const Route = createFileRoute("/community/map_/$entryId")({ component: MapDetailRoute });

function MapDetailRoute() {
  const { entryId } = Route.useParams();
  return <CommunityLazyRoute kind="map" itemId={entryId} />;
}
