import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shop/orders/")({
  component: ShopOrderList,
});

function ShopOrderList() {
  return (
    <div>
      <h1>รายการออเดอร์</h1>
      {/* TODO: <DeliveryQueueList /> */}
    </div>
  );
}
