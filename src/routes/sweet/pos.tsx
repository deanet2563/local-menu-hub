import { createFileRoute } from "@tanstack/react-router";
import { POSOrderScreen } from "@/components/pos/POSOrderScreen";

export const Route = createFileRoute("/sweet/pos")({
  component: POSPage,
});

function POSPage() {
  // TODO: ดึง shopId จริงจาก auth/session ของร้านที่ login อยู่
  // (รอ JWT custom claim customer_id ตาม CODEX_SCAFFOLD_INSTRUCTIONS.md)
  const shopId = "placeholder-shop-id";

  return <POSOrderScreen shopId={shopId} />;
}
