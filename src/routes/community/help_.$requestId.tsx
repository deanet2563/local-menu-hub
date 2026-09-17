import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetailRoute as CommunityLazyRoute } from "@/components/community/CommunityLazyRoute";

export const Route = createFileRoute("/community/help_/$requestId")({ component: HelpDetailRoute });

function HelpDetailRoute() {
  const { requestId } = Route.useParams();
  return <CommunityLazyRoute kind="help" itemId={requestId} />;
}
