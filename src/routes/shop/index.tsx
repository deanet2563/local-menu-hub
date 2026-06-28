import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shop/")({
  component: ShopDashboard,
});

function ShopDashboard() {
  return (
    <div>
      <h1>Shop Dashboard</h1>
      <p>แดชบอร์ดร้านค้า</p>
    </div>
  );
}
