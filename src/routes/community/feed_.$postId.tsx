import { createFileRoute } from "@tanstack/react-router";
import { CommunityDetail } from "@/components/community/CommunityDetail";

export const Route = createFileRoute("/community/feed_/$postId")({ component: PostDetailRoute });

function PostDetailRoute() {
  const { postId } = Route.useParams();
  return <CommunityDetail kind="post" itemId={postId} />;
}
