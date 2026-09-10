import { createFileRoute } from "@tanstack/react-router";
import { CustomerReviewCenter } from "@/components/customer/CustomerReviewCenter";
import { OrderHistory } from "@/components/customer/OrderHistory";

export const Route = createFileRoute("/orders")({
  component: CustomerOrdersPage,
});

function CustomerOrdersPage() {
  return <div className="customer-bottom-safe-padding">
    <CustomerReviewCenter />
    <OrderHistory />
  </div>;
}
