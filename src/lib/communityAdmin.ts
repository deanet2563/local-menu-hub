import { supabase } from "@/lib/supabase";

export type CommunityStatus = "draft" | "active" | "inactive" | "archived";
export type CommunityPrivacy = "public-preview" | "member-only" | "moderator-only";
export type BoundaryType = "village" | "soi" | "condo" | "neighborhood" | "district" | "subdistrict" | "service-area" | "organization";
export type LocationPrecision = "exact" | "entrance" | "block" | "community-centroid" | "hidden";

export type CommunityListItem = {
  community_id: string;
  slug: string;
  name: string;
  description: string | null;
  status: CommunityStatus;
  privacy_mode: CommunityPrivacy;
  boundary_type: BoundaryType;
  geography_summary: string | null;
  location_precision: LocationPrecision;
  member_count: number;
  moderator_count: number;
  created_at: string;
  updated_at: string;
};

export type CommunityModerator = {
  assignment_id: string;
  customer_id: string;
  name: string | null;
  moderator_role: "moderator" | "community-admin";
  status: "active" | "revoked";
  assigned_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
};

export type CommunityDetail = {
  community: CommunityListItem & {
    parent_community_id: string | null;
    province: string | null;
    district: string | null;
    subdistrict: string | null;
    village: string | null;
    soi: string | null;
    condo: string | null;
    approx_center_lat: number | null;
    approx_center_lng: number | null;
  };
  membership_summary: Record<string, number>;
  recent_joins: Array<{ role: string; relationship_label: string; joined_at: string | null }>;
  moderators: CommunityModerator[];
  audit_activity: Array<{ audit_id: number; actor_customer_id: string; actor_role_key: string; action: string; reason: string | null; created_at: string }>;
};

export type CommunityInput = {
  slug?: string;
  name: string;
  description: string;
  privacy_mode: CommunityPrivacy;
  boundary_type: BoundaryType;
  geography_summary: string;
  province: string;
  district: string;
  subdistrict: string;
  village: string;
  soi: string;
  condo: string;
  location_precision: LocationPrecision;
  parent_community_id: string | null;
  reason: string;
};

function rpcError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listCommunities(params: {
  search: string; status: string; privacy: string; sort: string; page: number; pageSize?: number;
}) {
  const { data, error } = await supabase.rpc("fn_admin_list_communities", {
    p_search: params.search || null,
    p_status: params.status || null,
    p_privacy_mode: params.privacy || null,
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: params.pageSize ?? 20,
  });
  rpcError(error);
  const value = data as { items?: CommunityListItem[]; total?: number; page?: number; page_size?: number } | null;
  return { items: value?.items ?? [], total: value?.total ?? 0, page: value?.page ?? params.page, pageSize: value?.page_size ?? 20 };
}

export async function getCommunity(communityId: string) {
  const { data, error } = await supabase.rpc("fn_admin_get_community", { p_community_id: communityId });
  rpcError(error);
  return data as CommunityDetail;
}

export async function createCommunity(input: CommunityInput) {
  const { data, error } = await supabase.rpc("fn_admin_create_community", {
    p_slug: input.slug,
    p_name: input.name,
    p_description: input.description || null,
    p_privacy_mode: input.privacy_mode,
    p_boundary_type: input.boundary_type,
    p_geography_summary: input.geography_summary || null,
    p_province: input.province || null,
    p_district: input.district || null,
    p_subdistrict: input.subdistrict || null,
    p_village: input.village || null,
    p_soi: input.soi || null,
    p_condo: input.condo || null,
    p_location_precision: input.location_precision,
    p_parent_community_id: input.parent_community_id,
    p_reason: input.reason,
  });
  rpcError(error);
  return data as string;
}

export async function updateCommunity(communityId: string, input: CommunityInput) {
  const { error } = await supabase.rpc("fn_admin_update_community", {
    p_community_id: communityId,
    p_name: input.name,
    p_description: input.description || null,
    p_privacy_mode: input.privacy_mode,
    p_boundary_type: input.boundary_type,
    p_geography_summary: input.geography_summary || null,
    p_province: input.province || null,
    p_district: input.district || null,
    p_subdistrict: input.subdistrict || null,
    p_village: input.village || null,
    p_soi: input.soi || null,
    p_condo: input.condo || null,
    p_location_precision: input.location_precision,
    p_parent_community_id: input.parent_community_id,
    p_reason: input.reason,
  });
  rpcError(error);
}

export async function setCommunityStatus(communityId: string, status: CommunityStatus, reason: string) {
  const { error } = await supabase.rpc("fn_admin_set_community_status", { p_community_id: communityId, p_status: status, p_reason: reason });
  rpcError(error);
}

export async function assignCommunityModerator(communityId: string, customerId: string, role: "moderator" | "community-admin", reason: string) {
  const { error } = await supabase.rpc("fn_admin_assign_community_moderator", {
    p_community_id: communityId, p_customer_id: customerId, p_moderator_role: role, p_reason: reason,
  });
  rpcError(error);
}

export async function revokeCommunityModerator(communityId: string, customerId: string, reason: string) {
  const { error } = await supabase.rpc("fn_admin_revoke_community_moderator", {
    p_community_id: communityId, p_customer_id: customerId, p_reason: reason,
  });
  rpcError(error);
}
