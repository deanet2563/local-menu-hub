import { createFileRoute } from "@tanstack/react-router";
import { FoodHub } from "@/components/customer/FoodHub";

export const Route = createFileRoute("/hub/")({
  component: FoodHub,
});
