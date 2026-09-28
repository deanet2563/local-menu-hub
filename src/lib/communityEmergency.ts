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


export type MyCommunity = {
  community_id: string;
  name: string;
  slug: string;
  geography_summary: string | null;
  boundary_type: string;
  location_precision: string;
  approx_center_lat: number | null;
  approx_center_lng: number | null;
};

export async function listMyActiveCommunities(): Promise<MyCommunity[]> {
  const { data, error } = await supabase.rpc("fn_my_active_communities");
  rpcError(error);
  return Array.isArray(data) ? data as MyCommunity[] : [];
}

export async function uploadIncidentEvidence(incidentId: string, file: File): Promise<string> {
  const customerId = await import("@/lib/supabase").then(({ getCurrentCustomerId }) => getCurrentCustomerId());
  if (!customerId) throw new Error("authentication required");
  const extension = (file.name.split(".").pop() || "jpg").replace(/[^A-Za-z0-9]/g, "").toLowerCase() || "jpg";
  const objectName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const path = `${customerId}/${incidentId}/${objectName}`;
  const bucket = "community-incident-evidence";
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { data, error } = await supabase.rpc("fn_register_incident_evidence", {
    p_incident_id: incidentId,
    p_storage_bucket: bucket,
    p_storage_path: path,
    p_captured_at: null,
  });
  rpcError(error);
  if (typeof data !== "string") throw new Error("incident_evidence_invalid_response");
  return data;
}


export type PublicIncident = {
  incident_id: string;
  community_id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: string;
  title: string | null;
  description: string | null;
  need_tags: string[];
  road_impact: RoadImpact;
  public_lat: number | null;
  public_lng: number | null;
  public_location_precision: PublicLocationPrecision;
  created_at: string;
  updated_at: string;
};

export type CommunityRisk = {
  risk_id: string;
  community_id: string | null;
  provenance: "official" | "forecast";
  hazard: string;
  level: "advisory" | "watch" | "warning" | "emergency";
  confidence: number | null;
  area_label: string | null;
  public_lat: number | null;
  public_lng: number | null;
  window_start: string;
  window_end: string;
  generated_at: string;
  updated_at: string;
  expires_at: string;
  preparation_guidance: unknown;
};

export async function getCommunitySafetySnapshot(communityId: string): Promise<{incidents: PublicIncident[]; risks: CommunityRisk[]}> {
  const [incidents, risks] = await Promise.all([listCommunityIncidents(communityId), listCommunityRisks(communityId)]);
  return { incidents: incidents as PublicIncident[], risks: risks as CommunityRisk[] };
}


export type CommunityResponsePoint = {
  response_point_id: string;
  community_id: string;
  name: string;
  contact_type: "official-emergency" | "community" | "volunteer" | "medical" | "shelter" | "other";
  phone: string | null;
  contact_metadata: Record<string, unknown>;
  status: "active";
  lat: number | null;
  lng: number | null;
  location_precision: PublicLocationPrecision;
  is_nearby: boolean;
};

export async function listCommunityResponsePoints(communityId: string): Promise<CommunityResponsePoint[]> {
  const { data, error } = await supabase.rpc("fn_list_community_response_points", {
    p_community_id: communityId, p_include_nearby: true,
  });
  rpcError(error);
  return Array.isArray(data) ? data as CommunityResponsePoint[] : [];
}
