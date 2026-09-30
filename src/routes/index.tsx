import { createFileRoute } from "@tanstack/react-router";
import { HomeOverview } from "@/components/customer/HomeOverview";
import { HomeErrorBoundary } from "@/components/customer/HomeErrorBoundary";

export const Route = createFileRoute("/")({
  component: () => <HomeErrorBoundary><HomeOverview /></HomeErrorBoundary>,
});
