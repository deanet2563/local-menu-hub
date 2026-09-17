import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetailRoute as CommunityLazyRoute } from "@/components/community/CommunityLazyRoute";

export const Route = createFileRoute("/community/events_/$eventId")({ component: EventDetailRoute });

function EventDetailRoute() {
  const { eventId } = Route.useParams();
  return <CommunityLazyRoute kind="event" itemId={eventId} />;
}
