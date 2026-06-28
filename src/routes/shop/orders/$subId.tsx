import { createFileRoute } from "@tanstack/react-router";
import { DeliveryStatusPanel } from "@/components/orders/DeliveryStatusPanel";

export const Route = createFileRoute("/shop/orders/$subId")({
  component: ShopOrderDetail,
});

function ShopOrderDetail() {
  const { subId } = Route.useParams();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">รายละเอียดออเดอร์</h1>
        <button
          onClick={() => window.open(`/sweet/print/${subId}`, "_blank")}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
        >
          🖨️ พิมพ์ใบสั่ง
        </button>
      </div>
      <DeliveryStatusPanel subId={subId} />
    </div>
  );
}
