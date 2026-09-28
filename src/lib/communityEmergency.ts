import { supabase } from "@/lib/supabase";

export type IncidentCategory =
  | "medical" | "flood" | "fire" | "accident" | "road-obstruction"
  | "utility-infrastructure" | "missing-person" | "evacuation-rescue" | "supplies" | "other";
export type IncidentSeverity = "unknown" | "low" | "moderate" | "high" | "critical";
export type RoadImpact = "unknown" | "passable" | "difficult" | "closed";
export type PublicLocationPrecision = "exact" | "entrance" | "block" | "community-centroid" | "hidden";

export type CreateIncidentInput = {
  communityId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title?: string;
  description?: string;
  needTags: string[];
  roadImpact: RoadImpact;
  exactLat: number;
  exactLng: number;
  publicLat?: number | null;
  publicLng?: number | null;
  publicLocationPrecision: PublicLocationPrecision;
};

function rpcError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createCommunityIncident(input: CreateIncidentInput): Promise<string> {
  const { data, error } = await supabase.rpc("fn_create_community_incident", {
    p_community_id: input.communityId,
    p_category: input.category,
    p_severity: input.severity,
    p_title: input.title?.trim() || null,
    p_description: input.description?.trim() || null,
    p_need_tags: input.needTags,
    p_road_impact: input.roadImpact,
    p_exact_lat: input.exactLat,
    p_exact_lng: input.exactLng,
    p_public_lat: input.publicLat ?? null,
    p_public_lng: input.publicLng ?? null,
    p_public_location_precision: input.publicLocationPrecision,
  });
  rpcError(error);
  if (typeof data !== "string") throw new Error("incident_create_invalid_response");
  return data;
}

export async function listCommunityIncidents(communityId: string) {
  const { data, error } = await supabase.rpc("fn_list_public_community_incidents", {
    p_community_id: communityId, p_limit: 100,
  });
  rpcError(error);
  return Array.isArray(data) ? data : [];
}

export async function listCommunityRisks(communityId: string) {
  const { data, error } = await supabase.rpc("fn_list_active_community_risks", {
    p_community_id: communityId, p_limit: 50,
  });
  rpcError(error);
  return Array.isArray(data) ? data : [];
}
