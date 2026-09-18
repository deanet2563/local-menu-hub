import { useMemo, useState } from "react";
import {
  EventsSurface,
  FeedSurface,
  GroupsSurface,
  HelpSurface,
  MapSurface,
  MarketplaceSurface,
} from "@/components/community/CommunityCards";
import { CommunityShell } from "@/components/community/CommunityShell";
import {
  COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY,
  COMMUNITY_PROTOTYPE_EVENTS,
  COMMUNITY_PROTOTYPE_GROUPS,
  COMMUNITY_PROTOTYPE_HELP_REQUESTS,
  COMMUNITY_PROTOTYPE_MAP_ENTRIES,
  COMMUNITY_PROTOTYPE_MARKETPLACE,
  COMMUNITY_PROTOTYPE_POSTS,
  type CommunityPrototypeSurface,
} from "@/lib/communityPrototype";

export function CommunityPrototype({ surface }: { surface: CommunityPrototypeSurface }) {
  const [communityId, setCommunityId] = useState(COMMUNITY_PROTOTYPE_DEFAULT_COMMUNITY.id);
  const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>(["group-yoga"]);
  const posts = useMemo(() => COMMUNITY_PROTOTYPE_POSTS.filter((item) => item.communityId === communityId), [communityId]);
  const groups = useMemo(() => COMMUNITY_PROTOTYPE_GROUPS.filter((item) => item.communityId === communityId), [communityId]);
  const events = useMemo(() => COMMUNITY_PROTOTYPE_EVENTS.filter((item) => item.communityId === communityId), [communityId]);
  const helpRequests = useMemo(() => COMMUNITY_PROTOTYPE_HELP_REQUESTS.filter((item) => item.communityId === communityId), [communityId]);
  const listings = useMemo(() => COMMUNITY_PROTOTYPE_MARKETPLACE.filter((item) => item.communityId === communityId), [communityId]);
  const mapEntries = useMemo(() => COMMUNITY_PROTOTYPE_MAP_ENTRIES.filter((item) => item.communityId === communityId), [communityId]);

  function toggleFavorite(groupId: string) {
    setFavoriteGroupIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  }

  return (
    <CommunityShell surface={surface} communityId={communityId} onCommunityChange={setCommunityId} showCreatePostAction={surface === "feed"}>
      {surface === "feed" ? (
        <FeedSurface
          posts={posts}
          events={events}
          groups={groups}
          favoriteGroupIds={favoriteGroupIds}
          communityId={communityId}
        />
      ) : null}
      {surface === "groups" ? <GroupsSurface groups={groups} favorites={favoriteGroupIds} onToggleFavorite={toggleFavorite} /> : null}
      {surface === "events" ? <EventsSurface events={events} /> : null}
      {surface === "help" ? <HelpSurface requests={helpRequests} /> : null}
      {surface === "marketplace" ? <MarketplaceSurface listings={listings} /> : null}
      {surface === "map" ? <MapSurface entries={mapEntries} /> : null}
    </CommunityShell>
  );
}
