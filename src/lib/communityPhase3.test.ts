import {
  COMMUNITY_PHASE3_PILOT,
  COMMUNITY_PHASE3_SECTIONS,
  buildCommunityMembershipScope,
  buildCommunityNavigationItems,
  canViewCommunitySurface,
  type CommunityMemberRole,
  type CommunityMembership,
} from "@/lib/communityPhase3";

const memberships: CommunityMembership[] = [
  {
    communityId: "sammakorn",
    role: "resident",
    status: "active",
    relationshipLabel: "home",
  },
  {
    communityId: "school-demo",
    role: "guardian",
    status: "active",
    relationshipLabel: "school",
  },
  {
    communityId: "work-demo",
    role: "worker",
    status: "pending",
    relationshipLabel: "work",
  },
];

const roles: CommunityMemberRole[] = ["resident", "guardian", "worker", "merchant", "moderator", "admin"];

export const communityPhase3CompileChecks = {
  pilotIsSammakornFirst: COMMUNITY_PHASE3_PILOT.slug === "sammakorn",
  userCanBelongToMultipleCommunities: buildCommunityMembershipScope(memberships).activeCommunityIds.length === 2,
  pendingMembershipIsNotVisible: canViewCommunitySurface("work-demo", memberships) === false,
  homeCommunityFeedIsVisible: canViewCommunitySurface("sammakorn", memberships) === true,
  sectionsIncludeNorthStarSurfaces: COMMUNITY_PHASE3_SECTIONS.map((section) => section.id),
  navHidesDatabaseBackedSurfacesUntilReady: buildCommunityNavigationItems("sammakorn").filter((item) => item.isEnabled).length,
  roleVocabulary: roles,
};
