import { createFileRoute } from "@tanstack/react-router";
import { HomeOverview } from "@/components/customer/HomeOverview";

export const Route = createFileRoute("/")({
  component: HomeOverview,
});
