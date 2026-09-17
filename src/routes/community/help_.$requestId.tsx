import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetail } from "@/components/community/CommunityDetail";

export const Route = createFileRoute("/community/help_/$requestId")({ component: HelpDetailRoute });

function HelpDetailRoute() {
  const { requestId } = Route.useParams();
  return <CommunityDetail kind="help" itemId={requestId} />;
}
