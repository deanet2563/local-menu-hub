import { createFileRoute } from "@tanstack/react-router";
import { CustomerMap } from "@/components/customer/CustomerMap";

export const Route = createFileRoute("/map")({
  validateSearch: (search: Record<string, unknown>) => ({ shop: typeof search.shop === "string" ? search.shop : undefined }),
  component: CustomerMapRoute,
});

function CustomerMapRoute() {
  const { shop } = Route.useSearch();
  return <CustomerMap initialShopId={shop ?? null} />;
}
