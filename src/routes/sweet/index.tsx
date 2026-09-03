import { createFileRoute } from "@tanstack/react-router";
import { ShopDashboard } from "@/components/shop/ShopDashboard";

export const Route = createFileRoute("/sweet/")({
  component: ShopDashboard,
});
