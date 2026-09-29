import { createFileRoute } from "@tanstack/react-router";
import { MyReportedIncidents } from "@/components/community/MyReportedIncidents";

export const Route = createFileRoute("/community/my-incidents/")({
  component: MyReportedIncidents,
});
