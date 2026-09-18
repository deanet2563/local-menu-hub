import { createFileRoute } from "@tanstack/react-router";
import { CommunitySurfaceRoute } from "@/components/community/CommunityLazyRoute";

export const Route = createFileRoute("/community/")({
  component: () => <CommunitySurfaceRoute surface="feed" />,
});
