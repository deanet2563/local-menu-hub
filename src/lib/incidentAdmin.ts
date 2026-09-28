import { supabase } from "@/lib/supabase";

export type AdminIncidentListItem = {
 incident_id:string;community_id:string;community_name:string;category:string;severity:string;status:string;
 verification_state:string;verification_count:number;title:string|null;description:string|null;need_tags:string[];
 road_impact:string;public_lat:number|null;public_lng:number|null;public_location_precision:string;
 created_at:string;updated_at:string;evidence_count:number;
};
export async function listAdminIncidents(filters:{search?:string;status?:string;severity?:string;verification?:string;page?:number}={}) {
 const {data,error}=await supabase.rpc("fn_admin_list_incidents",{p_community_id:null,p_status:filters.status||null,p_category:null,p_severity:filters.severity||null,p_verification:filters.verification||null,p_search:filters.search||null,p_page:filters.page||1,p_page_size:30});
 if(error)throw new Error(error.message);return data as {items:AdminIncidentListItem[];total:number;page:number;page_size:number};
}
export async function getAdminIncident(incidentId:string) {
 const {data,error}=await supabase.rpc("fn_admin_get_incident",{p_incident_id:incidentId});if(error)throw new Error(error.message);return data as Record<string,unknown>;
}
export async function setAdminIncidentStatus(incidentId:string,status:string,reason:string) {
 const {error}=await supabase.rpc("fn_admin_set_incident_status",{p_incident_id:incidentId,p_status:status,p_reason:reason});if(error)throw new Error(error.message);
}
export async function moderateAdminIncident(incidentId:string,action:"verify"|"duplicate",duplicateOf:string|null,reason:string) {
 const {error}=await supabase.rpc("fn_admin_verify_or_duplicate_incident",{p_incident_id:incidentId,p_action:action,p_duplicate_of:duplicateOf,p_reason:reason});if(error)throw new Error(error.message);
}


export async function listAdminResponsePoints(communityId:string) {
 const {data,error}=await supabase.rpc("fn_admin_list_community_response_points",{p_community_id:communityId});if(error)throw new Error(error.message);return Array.isArray(data)?data as Array<{response_point_id:string;name:string;contact_type:string;status:string}>:[];
}
export async function dispatchAdminIncident(incidentId:string,responsePointId:string,note:string,reason:string) {
 const {data,error}=await supabase.rpc("fn_admin_dispatch_incident",{p_incident_id:incidentId,p_response_point_id:responsePointId,p_note:note||null,p_reason:reason});if(error)throw new Error(error.message);return data as string;
}
export async function revealAdminIncidentPrivateLocation(incidentId:string,reason:string) {
 const {data,error}=await supabase.rpc("fn_admin_reveal_incident_private_location",{p_incident_id:incidentId,p_reason:reason});if(error)throw new Error(error.message);return data as {incident_id:string;exact_lat:number;exact_lng:number;revealed_at:string};
}
export async function listAdminIncidentEvidence(incidentId:string) {
 const {data,error}=await supabase.rpc("fn_admin_list_incident_evidence",{p_incident_id:incidentId});if(error)throw new Error(error.message);return Array.isArray(data)?data as Array<{evidence_id:string;storage_bucket:string;storage_path:string;created_at:string}>:[];
}
