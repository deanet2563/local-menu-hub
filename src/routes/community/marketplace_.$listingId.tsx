import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetail } from "@/components/community/CommunityDetail";

export const Route = createFileRoute("/community/marketplace_/$listingId")({ component: MarketplaceDetailRoute });

function MarketplaceDetailRoute() {
  const { listingId } = Route.useParams();
  return <CommunityDetail kind="marketplace" itemId={listingId} />;
}
