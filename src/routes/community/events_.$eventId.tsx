import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetail } from "@/components/community/CommunityDetail";

export const Route = createFileRoute("/community/events_/$eventId")({ component: EventDetailRoute });

function EventDetailRoute() {
  const { eventId } = Route.useParams();
  return <CommunityDetail kind="event" itemId={eventId} />;
}
