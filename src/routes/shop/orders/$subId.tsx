import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shop/orders/$subId")({
  component: ShopOrderDetail,
});

function ShopOrderDetail() {
  const { subId } = Route.useParams();
  return (
    <div>
      <h1>Order Detail</h1>
      <p>Sub Order: {subId}</p>
      {/* TODO: <DeliveryStatusPanel subId={subId} /> */}
    </div>
  );
}
