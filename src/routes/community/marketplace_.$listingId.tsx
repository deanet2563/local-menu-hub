import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetailRoute as CommunityLazyRoute } from "@/components/community/CommunityLazyRoute";

export const Route = createFileRoute("/community/marketplace_/$listingId")({ component: MarketplaceDetailRoute });

function MarketplaceDetailRoute() {
  const { listingId } = Route.useParams();
  return <CommunityLazyRoute kind="marketplace" itemId={listingId} />;
}
