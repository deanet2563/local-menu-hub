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

const moderatorOnlyMemberships: CommunityMembership[] = [
  {
    communityId: "sammakorn",
    role: "moderator",
    status: "active",
    relationshipLabel: "home",
  },
  {
    communityId: "school-demo",
    role: "admin",
    status: "active",
    relationshipLabel: "school",
  },
  {
    communityId: "work-demo",
    role: "moderator",
    status: "pending",
    relationshipLabel: "work",
  },
  {
    communityId: "merchant-demo",
    role: "merchant",
    status: "active",
    relationshipLabel: "merchant",
  },
  {
    communityId: "resident-demo",
    role: "resident",
    status: "active",
    relationshipLabel: "home",
  },
];

const roles: CommunityMemberRole[] = ["resident", "guardian", "worker", "merchant", "moderator", "admin"];

export const communityPhase3CompileChecks = {
  pilotIsSammakornFirst: COMMUNITY_PHASE3_PILOT.slug === "sammakorn",
  userCanBelongToMultipleCommunities: buildCommunityMembershipScope(memberships).activeCommunityIds.length === 2,
  pendingMembershipIsNotVisible: canViewCommunitySurface("work-demo", memberships) === false,
  homeCommunityFeedIsVisible: canViewCommunitySurface("sammakorn", memberships) === true,
  moderatorCanViewModeratorOnly: canViewCommunitySurface("sammakorn", moderatorOnlyMemberships, "moderator-only") === true,
  adminCanViewModeratorOnly: canViewCommunitySurface("school-demo", moderatorOnlyMemberships, "moderator-only") === true,
  residentCannotViewModeratorOnly: canViewCommunitySurface("resident-demo", moderatorOnlyMemberships, "moderator-only") === false,
  merchantCannotViewModeratorOnly: canViewCommunitySurface("merchant-demo", moderatorOnlyMemberships, "moderator-only") === false,
  inactiveModeratorCannotViewModeratorOnly: canViewCommunitySurface("work-demo", moderatorOnlyMemberships, "moderator-only") === false,
  crossCommunityModeratorCannotViewModeratorOnly: canViewCommunitySurface("merchant-demo", [{
    communityId: "sammakorn",
    role: "moderator",
    status: "active",
    relationshipLabel: "home",
  }], "moderator-only") === false,
  sectionsIncludeNorthStarSurfaces: COMMUNITY_PHASE3_SECTIONS.map((section) => section.id),
  navHidesDatabaseBackedSurfacesUntilReady: buildCommunityNavigationItems("sammakorn").filter((item) => item.isEnabled).length,
  roleVocabulary: roles,
};
