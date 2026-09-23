import { createFileRoute } from "@tanstack/react-router";
import { FoodHub } from "@/components/customer/FoodHub";
import { FoodHubErrorBoundary } from "@/components/customer/FoodHubErrorBoundary";

export const Route = createFileRoute("/hub/")({
  component: () => (
    <FoodHubErrorBoundary>
      <FoodHub />
    </FoodHubErrorBoundary>
  ),
});
