import { createFileRoute } from "@tanstack/react-router";
import { CommunityIncidentMap } from "@/components/community/CommunityIncidentMap";

export const Route = createFileRoute("/community/incidents")({
  component: CommunityIncidentMap,
});
