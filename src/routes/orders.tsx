import { createFileRoute } from "@tanstack/react-router";
import { OrderHistory } from "@/components/customer/OrderHistory";

export const Route = createFileRoute("/orders")({
  component: OrderHistory,
});
