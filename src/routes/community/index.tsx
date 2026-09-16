import { createFileRoute } from "@tanstack/react-router";
import { CommunityPhase3Home } from "@/components/community/CommunityPhase3Home";

export const Route = createFileRoute("/community/")({
  component: CommunityPhase3Home,
});
