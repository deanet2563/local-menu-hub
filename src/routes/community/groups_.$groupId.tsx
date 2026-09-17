import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetailRoute as CommunityLazyRoute } from "@/components/community/CommunityLazyRoute";

export const Route = createFileRoute("/community/groups_/$groupId")({ component: GroupDetailRoute });

function GroupDetailRoute() {
  const { groupId } = Route.useParams();
  return <CommunityLazyRoute kind="group" itemId={groupId} />;
}
