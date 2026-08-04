import { createFileRoute } from "@tanstack/react-router";
import { ShopPage } from "@/components/customer/ShopPage";

export const Route = createFileRoute("/shop/$shopId")({
  component: ShopRoute,
});

function ShopRoute() {
  const { shopId } = Route.useParams();
  return <ShopPage shopId={shopId} />;
}
