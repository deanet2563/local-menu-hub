import {
  COMMUNITY_PROTOTYPE_EVENTS,
  COMMUNITY_PROTOTYPE_GROUPS,
  COMMUNITY_PROTOTYPE_HELP_REQUESTS,
  COMMUNITY_PROTOTYPE_MAP_ENTRIES,
  COMMUNITY_PROTOTYPE_MARKETPLACE,
  COMMUNITY_PROTOTYPE_POSTS,
  getCommunityPrototypeDetail,
} from "@/lib/communityPrototype";

export const communityPrototypeContractChecks = {
  publishedPost: getCommunityPrototypeDetail("post", "post-pinned-safety", "sammakorn")?.status === "published",
  invalidPostDenied: getCommunityPrototypeDetail("post", "missing-post", "sammakorn") === undefined,
  crossCommunityDenied: getCommunityPrototypeDetail("post", "post-pinned-safety", "office-rama9") === undefined,
  postLifecycle: COMMUNITY_PROTOTYPE_POSTS.map((item) => item.status),
  groupLifecycle: COMMUNITY_PROTOTYPE_GROUPS.map((item) => item.status),
  eventLifecycle: COMMUNITY_PROTOTYPE_EVENTS.map((item) => item.status),
  helpLifecycle: COMMUNITY_PROTOTYPE_HELP_REQUESTS.map((item) => item.status),
  marketplaceLifecycle: COMMUNITY_PROTOTYPE_MARKETPLACE.map((item) => item.status),
  mapLifecycle: COMMUNITY_PROTOTYPE_MAP_ENTRIES.map((item) => item.status),
};
