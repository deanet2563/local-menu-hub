import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetail } from "@/components/community/CommunityDetail";

export const Route = createFileRoute("/community/groups_/$groupId")({ component: GroupDetailRoute });

function GroupDetailRoute() {
  const { groupId } = Route.useParams();
  return <CommunityDetail kind="group" itemId={groupId} />;
}
