import { createFileRoute } from "@tanstack/react-router";
import { DeliveryQueueList } from "@/components/orders/DeliveryStatusPanel";

export const Route = createFileRoute("/shop/orders/")({
  component: ShopOrderList,
});

function ShopOrderList() {
  // TODO: ดึง shopId จริงจาก auth/session ของร้านที่ login อยู่
  // ตอนนี้ยังไม่มี auth flow (รอ JWT custom claim customer_id ตาม
  // CODEX_SCAFFOLD_INSTRUCTIONS.md) จึงใส่ placeholder ไว้ก่อน
  const shopId = "placeholder-shop-id";

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">รายการออเดอร์</h1>
      <DeliveryQueueList shopId={shopId} />
    </div>
  );
}
