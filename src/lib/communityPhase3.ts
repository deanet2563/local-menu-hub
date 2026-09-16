export type CommunityPilotMode = "sammakorn-first" | "multi-community-ready";

export type CommunityVisibility = "public-preview" | "member-only" | "moderator-only";

export type CommunitySurfaceKind =
  | "feed"
  | "posts"
  | "events"
  | "help-requests"
  | "marketplace"
  | "groups"
  | "map";

export type CommunityMemberRole = "resident" | "guardian" | "worker" | "merchant" | "moderator" | "admin";

export type CommunityMembershipStatus = "active" | "pending" | "suspended" | "left";

export type CommunityRelationshipLabel = "home" | "work" | "school" | "merchant" | "other";

export type CommunityDefinition = {
  id: string;
  slug: string;
  name: string;
  parentCommunityId: string | null;
  pilotMode: CommunityPilotMode;
  boundaryLabel: string;
  defaultVisibility: CommunityVisibility;
};

export type CommunityMembership = {
  communityId: string;
  role: CommunityMemberRole;
  status: CommunityMembershipStatus;
  relationshipLabel: CommunityRelationshipLabel;
};

export type CommunitySection = {
  id: CommunitySurfaceKind;
  label: string;
  description: string;
  visibility: CommunityVisibility;
  requiresDatabase: boolean;
};

export type CommunityNavigationItem = {
  id: CommunitySurfaceKind;
  label: string;
  href: string;
  isEnabled: boolean;
  visibility: CommunityVisibility;
};

export type CommunityMembershipScope = {
  activeCommunityIds: string[];
  pendingCommunityIds: string[];
  relationships: CommunityRelationshipLabel[];
};

export const COMMUNITY_PHASE3_PILOT: CommunityDefinition = {
  id: "sammakorn",
  slug: "sammakorn",
  name: "Sammakorn Village",
  parentCommunityId: null,
  pilotMode: "sammakorn-first",
  boundaryLabel: "Ramkhamhaeng 110/112 pilot boundary",
  defaultVisibility: "member-only",
};

export const COMMUNITY_PHASE3_SECTIONS: CommunitySection[] = [
  {
    id: "feed",
    label: "Private Feed",
    description: "Member-visible community updates scoped to one community boundary.",
    visibility: "member-only",
    requiresDatabase: true,
  },
  {
    id: "posts",
    label: "Posts",
    description: "Resident and moderator posts with future moderation/audit requirements.",
    visibility: "member-only",
    requiresDatabase: true,
  },
  {
    id: "events",
    label: "Events",
    description: "Community calendar items for local activities and announcements.",
    visibility: "member-only",
    requiresDatabase: true,
  },
  {
    id: "help-requests",
    label: "Help Requests",
    description: "Neighbor help, lost/found, and support requests within a trusted boundary.",
    visibility: "member-only",
    requiresDatabase: true,
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Local buy/sell/share listings separated from food ordering contracts.",
    visibility: "member-only",
    requiresDatabase: true,
  },
  {
    id: "groups",
    label: "Groups and Clubs",
    description: "Sub-community groups for clubs, school circles, and interest groups.",
    visibility: "member-only",
    requiresDatabase: true,
  },
  {
    id: "map",
    label: "Community Map",
    description: "Community-owned map layer and discovery entry point, without provider data persistence.",
    visibility: "public-preview",
    requiresDatabase: false,
  },
];

export function buildCommunityMembershipScope(memberships: CommunityMembership[]): CommunityMembershipScope {
  const active = memberships.filter((membership) => membership.status === "active");
  return {
    activeCommunityIds: active.map((membership) => membership.communityId),
    pendingCommunityIds: memberships
      .filter((membership) => membership.status === "pending")
      .map((membership) => membership.communityId),
    relationships: Array.from(new Set(active.map((membership) => membership.relationshipLabel))),
  };
}

export function canViewCommunitySurface(
  communityId: string,
  memberships: CommunityMembership[],
  visibility: CommunityVisibility = "member-only",
): boolean {
  if (visibility === "public-preview") return true;
  if (visibility === "member-only") {
    return memberships.some((membership) => membership.communityId === communityId && membership.status === "active");
  }
  if (visibility === "moderator-only") {
    return memberships.some((membership) => (
      membership.communityId === communityId
      && membership.status === "active"
      && (membership.role === "moderator" || membership.role === "admin")
    ));
  }
  return false;
}

export function buildCommunityNavigationItems(communitySlug: string): CommunityNavigationItem[] {
  return COMMUNITY_PHASE3_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    href: `/community/${communitySlug}/${section.id}`,
    isEnabled: !section.requiresDatabase,
    visibility: section.visibility,
  }));
}
