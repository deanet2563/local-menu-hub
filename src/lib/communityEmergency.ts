import { supabase } from "@/lib/supabase";

export type IncidentCategory =
  | "medical" | "flood" | "fire" | "accident" | "road-obstruction"
  | "utility-infrastructure" | "missing-person" | "evacuation-rescue" | "supplies" | "other";
export type IncidentSeverity = "unknown" | "low" | "moderate" | "high" | "critical";
export type RoadImpact = "unknown" | "passable" | "difficult" | "closed";
export type PublicLocationPrecision = "exact" | "entrance" | "block" | "community-centroid" | "hidden";

export type EmergencyAreaResolution = {
  community_id: string | null;
  community_name: string | null;
  area_label: string;
  province: string | null;
  district: string | null;
  distance_m: number | null;
  resolution_method: "coverage-radius" | "outside-coverage";
  inside_coverage: boolean;
};

export type EmergencyContact = {
  contact_id: string;
  service_key: "medical" | "police" | "disaster" | "fire" | "water" | "road" | "other";
  name: string;
  phone: string;
  scope_type: "national" | "province" | "community";
  priority: number;
  verified_source_label: string;
  verified_at: string;
};

export type EmergencyReportingAccess = {
  allowed: boolean;
  reason?: string;
  reason_code?: string;
  ends_at?: string | null;
};

export type EmergencyReporterProfile = {
  customer_id: string;
  name: string | null;
  phone: string | null;
  default_address: string | null;
};

export type IncidentConversation = {
  incident_id: string;
  status: string;
  viewer_is_reporter?: boolean;
  can_accept?: boolean;
  viewer_responder?: {
    responder_id: string;
    name: string;
    phone: string;
    organization: string | null;
    status: string;
    review?: {
      rating: number;
      comment: string | null;
      updated_at: string;
    } | null;
  } | null;
  resolution?: {
    thanks_mytree: boolean;
    thanks_message: string | null;
    good_deed_point_awarded: boolean;
    resolved_at: string;
  } | null;
  responders: Array<{
    responder_id: string;
    name: string;
    phone: string | null;
    organization: string | null;
    status: string;
    accepted_at: string;
    review?: {
      rating: number;
      comment: string | null;
      updated_at: string;
    } | null;
  }>;
  messages: Array<{
    message_id: string;
    sender_kind: "reporter" | "responder";
    sender_name: string;
    action: "message" | "accepted" | "request-info" | "help-en-route" | "arrived" | "assisted";
    body: string;
    created_at: string;
  }>;
};

export type SharedIncidentPayload = {
  share_id?: string;
  expires_at?: string;
  incident: {
    incident_id: string;
    category: IncidentCategory;
    severity: IncidentSeverity;
    status: string;
    title: string | null;
    description: string | null;
    need_tags: string[];
    road_impact: RoadImpact;
    exact_lat: number;
    exact_lng: number;
    detected_area_label: string | null;
    created_at: string;
    updated_at: string;
  };
  contact: {
    name: string | null;
    phone: string | null;
    address: string | null;
    submitted_map_url: string | null;
  };
  community: { community_id: string; name: string } | null;
  evidence: Array<{
    evidence_id: string;
    media_type: "image";
    captured_at: string | null;
    created_at: string;
  }>;
};

export type CreateIncidentInput = {
  communityId: string | null;
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
  reporterName?: string;
  reporterPhone?: string;
  incidentAddress?: string;
  submittedMapUrl?: string;
};

function rpcError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function resolveEmergencyArea(lat: number, lng: number): Promise<EmergencyAreaResolution> {
  const { data, error } = await supabase.rpc("fn_resolve_emergency_area", { p_lat: lat, p_lng: lng });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("emergency_area_resolution_failed");
  return data as EmergencyAreaResolution;
}

export async function recommendEmergencyContacts(
  category: IncidentCategory,
  needTags: string[],
  area: EmergencyAreaResolution | null,
): Promise<EmergencyContact[]> {
  const { data, error } = await supabase.rpc("fn_recommend_emergency_contacts", {
    p_category: category,
    p_need_tags: needTags,
    p_community_id: area?.community_id ?? null,
    p_province: area?.province ?? null,
  });
  rpcError(error);
  return Array.isArray(data) ? data as EmergencyContact[] : [];
}

export async function getEmergencyReportingAccess(): Promise<EmergencyReportingAccess> {
  const { data, error } = await supabase.rpc("fn_get_my_emergency_reporting_access");
  rpcError(error);
  if (!data || typeof data !== "object") return { allowed: true };
  return data as EmergencyReportingAccess;
}

export async function getMyEmergencyProfile(): Promise<EmergencyReporterProfile> {
  const { data, error } = await supabase.rpc("fn_get_my_emergency_profile");
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("emergency_profile_unavailable");
  return data as EmergencyReporterProfile;
}

export async function resolveEmergencyGoogleMapLink(value: string): Promise<{
  lat: number;
  lng: number;
  formattedAddress?: string;
  displayName?: string;
}> {
  const workerBase = (import.meta.env.VITE_MYTREE_WORKER_URL || "https://mytree-worker.kompakorn-t.workers.dev").replace(/\/$/, "");
  const response = await fetch(`${workerBase}/location/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  const payload = await response.json() as {
    location?: { lat?: number; lng?: number; formattedAddress?: string; displayName?: string };
    error?: string;
  };
  if (!response.ok || typeof payload.location?.lat !== "number" || typeof payload.location?.lng !== "number") {
    throw new Error(payload.error || "google_maps_location_resolve_failed");
  }
  return {
    lat: payload.location.lat,
    lng: payload.location.lng,
    formattedAddress: payload.location.formattedAddress,
    displayName: payload.location.displayName,
  };
}

export async function createIncidentShare(incidentId: string, expiresHours = 168): Promise<string> {
  const { data, error } = await supabase.rpc("fn_create_incident_share", {
    p_incident_id: incidentId,
    p_expires_hours: expiresHours,
  });
  rpcError(error);
  if (typeof data !== "string") throw new Error("incident_share_invalid_response");
  return data;
}

export async function getSharedIncident(token: string): Promise<SharedIncidentPayload> {
  const { data, error } = await supabase.rpc("fn_get_shared_incident", { p_token: token });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("shared_incident_invalid_response");
  return data as SharedIncidentPayload;
}

export async function getReporterIncidentDashboard(incidentId: string): Promise<SharedIncidentPayload> {
  const { data, error } = await supabase.rpc("fn_get_reporter_incident_dashboard", { p_incident_id: incidentId });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("reporter_incident_invalid_response");
  return data as SharedIncidentPayload;
}

export async function getResponderIncidentDashboard(incidentId: string): Promise<SharedIncidentPayload> {
  const { data, error } = await supabase.rpc("fn_get_responder_incident_dashboard", { p_incident_id: incidentId });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("responder_incident_invalid_response");
  return data as SharedIncidentPayload;
}

export async function getSharedIncidentEvidenceUrl(token: string, evidenceId: string): Promise<string> {
  const accessToken = await import("@/lib/supabase").then(({ getAccessToken }) => getAccessToken());
  if (!accessToken) throw new Error("authentication required");
  const workerBase = (import.meta.env.VITE_MYTREE_WORKER_URL || "https://mytree-worker.kompakorn-t.workers.dev").replace(/\/$/, "");
  const response = await fetch(`${workerBase}/community/shared-evidence-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ token, evidenceId }),
  });
  const payload = await response.json() as { url?: string; error?: string };
  if (!response.ok || !payload.url) throw new Error(payload.error || "shared_evidence_failed");
  return payload.url;
}

async function incidentConversationAction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const accessToken = await import("@/lib/supabase").then(({ getAccessToken }) => getAccessToken());
  if (!accessToken) throw new Error("authentication required");
  const workerBase = (import.meta.env.VITE_MYTREE_WORKER_URL || "https://mytree-worker.kompakorn-t.workers.dev").replace(/\/$/, "");
  const response = await fetch(`${workerBase}/community/incident-conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(payload.error || "incident_conversation_action_failed");
  return payload;
}

export async function getSharedIncidentConversation(token: string): Promise<IncidentConversation> {
  const { data, error } = await supabase.rpc("fn_get_shared_incident_conversation", { p_token: token });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("incident_conversation_invalid_response");
  return data as IncidentConversation;
}

export async function getReporterIncidentConversation(incidentId: string): Promise<IncidentConversation> {
  const { data, error } = await supabase.rpc("fn_get_incident_conversation_for_reporter", { p_incident_id: incidentId });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("incident_conversation_invalid_response");
  return data as IncidentConversation;
}

export async function getResponderIncidentConversation(incidentId: string): Promise<IncidentConversation> {
  const { data, error } = await supabase.rpc("fn_get_responder_incident_conversation", { p_incident_id: incidentId });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("incident_conversation_invalid_response");
  return data as IncidentConversation;
}

export async function acceptSharedIncident(
  token: string,
  responderName: string,
  responderPhone: string,
  responderOrganization?: string,
): Promise<void> {
  await incidentConversationAction({
    mode: "accept",
    token,
    responderName,
    responderPhone,
    responderOrganization: responderOrganization?.trim() || null,
  });
}

export async function sendResponderIncidentMessage(
  token: string,
  message: string,
  action: "message" | "request-info" | "help-en-route" | "arrived" | "assisted" = "message",
): Promise<void> {
  await incidentConversationAction({ mode: "responder-message", token, message, action });
}

export async function sendReporterIncidentMessage(incidentId: string, message: string): Promise<void> {
  await incidentConversationAction({ mode: "reporter-message", incidentId, message });
}

export async function sendAcceptedResponderIncidentMessage(
  incidentId: string,
  message: string,
  action: "message" | "request-info" | "help-en-route" | "arrived" | "assisted" = "message",
): Promise<void> {
  await incidentConversationAction({ mode: "accepted-responder-message", incidentId, message, action });
}

export async function resolveReporterIncident(
  incidentId: string,
  thanksMyTree: boolean,
  thanksMessage?: string,
): Promise<{
  incident_id: string;
  status: "resolved";
  good_deed_point_awarded: boolean;
  good_deed_point_eligible: boolean;
  good_deed_points_total: number;
}> {
  const { data, error } = await supabase.rpc("fn_reporter_resolve_incident", {
    p_incident_id: incidentId,
    p_thanks_mytree: thanksMyTree,
    p_thanks_message: thanksMessage?.trim() || null,
  });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("incident_resolution_invalid_response");
  return data as {
    incident_id: string;
    status: "resolved";
    good_deed_point_awarded: boolean;
    good_deed_point_eligible: boolean;
    good_deed_points_total: number;
  };
}

export async function updateReporterResolutionFeedback(
  incidentId: string,
  thanksMyTree: boolean,
  thanksMessage?: string,
): Promise<void> {
  const { error } = await supabase.rpc("fn_reporter_update_resolution_feedback", {
    p_incident_id: incidentId,
    p_thanks_mytree: thanksMyTree,
    p_thanks_message: thanksMessage?.trim() || null,
  });
  rpcError(error);
}

export async function reviewIncidentResponder(
  incidentId: string,
  responderId: string,
  rating: number,
  comment?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_reporter_review_responder", {
    p_incident_id: incidentId,
    p_responder_id: responderId,
    p_rating: rating,
    p_comment: comment?.trim() || null,
  });
  rpcError(error);
  if (typeof data !== "string") throw new Error("responder_review_invalid_response");
  return data;
}

export async function getMyGoodDeedPoints(): Promise<{
  total: number;
  history: Array<{
    ledger_id: string;
    points: number;
    reason_code: string;
    incident_id: string | null;
    created_at: string;
  }>;
}> {
  const { data, error } = await supabase.rpc("fn_get_my_good_deed_points");
  rpcError(error);
  if (!data || typeof data !== "object") return { total: 0, history: [] };
  return data as {
    total: number;
    history: Array<{
      ledger_id: string;
      points: number;
      reason_code: string;
      incident_id: string | null;
      created_at: string;
    }>;
  };
}

export async function getPrivateIncidentEvidenceUrl(
  viewer: "reporter" | "responder",
  incidentId: string,
  evidenceId: string,
): Promise<string> {
  const accessToken = await import("@/lib/supabase").then(({ getAccessToken }) => getAccessToken());
  if (!accessToken) throw new Error("authentication required");
  const workerBase = (import.meta.env.VITE_MYTREE_WORKER_URL || "https://mytree-worker.kompakorn-t.workers.dev").replace(/\/$/, "");
  const response = await fetch(`${workerBase}/community/private-evidence-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ viewer, incidentId, evidenceId }),
  });
  const payload = await response.json() as { url?: string; error?: string };
  if (!response.ok || !payload.url) throw new Error(payload.error || "private_evidence_failed");
  return payload.url;
}

export async function createCommunityIncident(input: CreateIncidentInput): Promise<string> {
  const { data, error } = await supabase.rpc("fn_create_community_incident_v3", {
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
    p_reporter_name: input.reporterName?.trim() || null,
    p_reporter_phone: input.reporterPhone?.trim() || null,
    p_incident_address: input.incidentAddress?.trim() || null,
    p_submitted_map_url: input.submittedMapUrl?.trim() || null,
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


export type EmergencyCommunityOption = {
  community_id: string;
  name: string;
  slug: string;
  geography_summary: string | null;
  privacy_mode: string;
  approx_center_lat: number | null;
  approx_center_lng: number | null;
};

export type NearbyPublicIncident = PublicIncident & {
  community_name: string;
  distance_m: number;
};

export type PublicIncidentHelpState = {
  viewer_is_reporter: boolean;
  can_accept: boolean;
  viewer_responder: {
    responder_id: string;
    name: string;
    phone: string;
    organization: string | null;
    status: string;
  } | null;
};

export type PublicIncidentDetail = {
  incident: PublicIncident & {
    community_name: string;
    resolved_at: string | null;
  };
  summary: {
    responder_count: number;
    message_count: number;
  };
};

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

export async function listEmergencyCommunities(): Promise<EmergencyCommunityOption[]> {
  const { data, error } = await supabase.rpc("fn_list_emergency_communities");
  rpcError(error);
  return Array.isArray(data) ? data as EmergencyCommunityOption[] : [];
}

export async function listBrowseCommunityIncidents(
  communityId: string,
): Promise<Array<PublicIncident & { community_name: string }>> {
  const accessToken = await import("@/lib/supabase").then(({ getAccessToken }) => getAccessToken());
  if (!accessToken) throw new Error("authentication required");
  const workerBase = (import.meta.env.VITE_MYTREE_WORKER_URL || "https://mytree-worker.kompakorn-t.workers.dev").replace(/\/$/, "");
  const response = await fetch(
    `${workerBase}/community/public-incidents?communityId=${encodeURIComponent(communityId)}&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json() as unknown;
  if (!response.ok) {
    const error = payload as { error?: string };
    throw new Error(error.error || "public_incident_list_failed");
  }
  return Array.isArray(payload)
    ? payload as Array<PublicIncident & { community_name: string }>
    : [];
}

export async function listNearbyPublicIncidents(
  lat: number,
  lng: number,
  radiusMeters = 5000,
): Promise<NearbyPublicIncident[]> {
  const { data, error } = await supabase.rpc("fn_list_nearby_public_incidents", {
    p_lat: lat,
    p_lng: lng,
    p_radius_meters: radiusMeters,
    p_limit: 100,
  });
  rpcError(error);
  return Array.isArray(data) ? data as NearbyPublicIncident[] : [];
}

export async function getPublicIncidentDetail(incidentId: string): Promise<PublicIncidentDetail> {
  const accessToken = await import("@/lib/supabase").then(({ getAccessToken }) => getAccessToken());
  if (!accessToken) throw new Error("authentication required");
  const workerBase = (import.meta.env.VITE_MYTREE_WORKER_URL || "https://mytree-worker.kompakorn-t.workers.dev").replace(/\/$/, "");
  const response = await fetch(
    `${workerBase}/community/public-incidents/${encodeURIComponent(incidentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json() as PublicIncidentDetail & { error?: string };
  if (!response.ok) throw new Error(payload.error || "public_incident_detail_failed");
  if (!payload || typeof payload !== "object") throw new Error("public_incident_detail_invalid_response");
  return payload;
}

export async function getPublicIncidentHelpState(incidentId: string): Promise<PublicIncidentHelpState> {
  const { data, error } = await supabase.rpc("fn_get_public_incident_help_state", {
    p_incident_id: incidentId,
  });
  rpcError(error);
  if (!data || typeof data !== "object") throw new Error("public_incident_help_state_invalid_response");
  return data as PublicIncidentHelpState;
}

export async function acceptPublicIncident(
  incidentId: string,
  responderName: string,
  responderPhone: string,
  responderOrganization?: string,
  message?: string,
): Promise<void> {
  await incidentConversationAction({
    mode: "public-accept",
    incidentId,
    responderName,
    responderPhone,
    responderOrganization: responderOrganization?.trim() || null,
    message: message?.trim() || null,
  });
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


export type MyReportedIncident = {
  incident_id: string;
  community_id: string | null;
  community_name: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: string;
  verification_state: string;
  title: string | null;
  description: string | null;
  need_tags: string[];
  road_impact: RoadImpact;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  responder_count: number;
  message_count: number;
  last_message_at: string | null;
  has_resolution: boolean;
};

export async function listMyReportedIncidents(status?: string): Promise<MyReportedIncident[]> {
  const { data, error } = await supabase.rpc("fn_list_my_reported_incidents", {
    p_status: status || null,
    p_limit: 100,
  });
  rpcError(error);
  return Array.isArray(data) ? data as MyReportedIncident[] : [];
}

export type PublicIncident = {
  incident_id: string;
  community_id: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: string;
  verification_state?: "unverified" | "community-confirmed" | "moderator-verified" | "official-confirmed" | "disputed";
  verification_count?: number;
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


export async function confirmCommunityIncident(incidentId: string, confirmation: "confirm" | "dispute", note?: string) {
  const { data, error } = await supabase.rpc("fn_confirm_community_incident", {
    p_incident_id: incidentId, p_confirmation: confirmation, p_note: note?.trim() || null,
  });
  rpcError(error);
  return data as string;
}


export type SafetyRouteOption = {
  routeIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  impactScore: number;
  impacts: Array<{
    incidentId: string;
    impact: "difficult" | "closed";
    verification: string;
    updatedAt: string;
    ageHours: number;
    distanceFromRouteMeters: number;
    stale: boolean;
    weight: number;
  }>;
};

export async function analyzeCommunitySafetyRoutes(
  communityId: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<{ advisory: string; routes: SafetyRouteOption[] }> {
  const token = await import("@/lib/supabase").then(({ getAccessToken }) => getAccessToken());
  if (!token) throw new Error("authentication required");
  const workerBase = (import.meta.env.VITE_MYTREE_WORKER_URL || "https://mytree-worker.kompakorn-t.workers.dev").replace(/\/$/, "");
  const response = await fetch(`${workerBase}/community/safety-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ communityId, origin, destination }),
  });
  const payload = await response.json() as { advisory?: string; routes?: SafetyRouteOption[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "safety_route_failed");
  return { advisory: payload.advisory || "", routes: payload.routes || [] };
}
