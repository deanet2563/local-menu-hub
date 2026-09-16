import { createFileRoute } from "@tanstack/react-router";
import { CommunityPrototype } from "@/components/community/CommunityPrototype";

export const Route = createFileRoute("/community/events")({
  component: () => <CommunityPrototype surface="events" />,
});

