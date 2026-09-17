import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetailRoute as CommunityLazyRoute } from "@/components/community/CommunityLazyRoute";

export const Route = createFileRoute("/community/feed_/$postId")({ component: PostDetailRoute });

function PostDetailRoute() {
  const { postId } = Route.useParams();
  return <CommunityLazyRoute kind="post" itemId={postId} />;
}
