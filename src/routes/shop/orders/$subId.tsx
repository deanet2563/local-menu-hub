import { createFileRoute } from "@tanstack/react-router";
import { DeliveryStatusPanel } from "@/components/orders/DeliveryStatusPanel";

export const Route = createFileRoute("/shop/orders/$subId")({
  component: ShopOrderDetail,
});

function ShopOrderDetail() {
  const { subId } = Route.useParams();
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">รายละเอียดออเดอร์</h1>
      <DeliveryStatusPanel subId={subId} />
    </div>
  );
}
