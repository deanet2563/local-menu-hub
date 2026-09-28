import { createFileRoute } from "@tanstack/react-router";
import { CommunityIncidentReport } from "@/components/community/CommunityIncidentReport";

export const Route = createFileRoute("/community/report")({
  component: CommunityIncidentReport,
});
