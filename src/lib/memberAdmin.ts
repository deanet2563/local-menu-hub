import { supabase } from "@/lib/supabase";

export type MemberStatus = "active" | "suspended" | "banned";
export type MemberListItem = {
  customer_id:string; name:string|null; phone:string|null; created_at:string; status:MemberStatus;
  line_linked:boolean; last_active_at:string|null; is_rider:boolean; is_shop_staff:boolean;
  is_community_moderator:boolean; is_platform_admin:boolean; deletion_status:string;
};
export type MemberDetail = {
  member:{customer_id:string;name:string|null;phone:string|null;created_at:string;status:MemberStatus;banned_reason:string|null;banned_at:string|null;suspended_reason:string|null;suspended_at:string|null;deletion_status:string;deletion_requested_at:string|null;deletion_reason:string|null};
  identity:{line_linked:boolean;providers:string[];mapping_conflict:boolean};
  roles:Record<string,boolean>;
  communities:Array<{community_id:string;name:string;role:string;status:string;joined_at:string|null}>;
  shops:Array<{shop_id:string;shop_name:string;role:string}>;
  rider:{rider_id:string;approved:boolean;banned:boolean;class:string}|null;
  activity:Record<string,{available:boolean;count?:number;last_at?:string|null;last_active_at?:string|null}>;
  notes:Array<{note_id:number;note:string;created_by:string;created_at:string}>;
  audit:Array<{audit_id:number;actor_customer_id:string;actor_role_key:string;action:string;reason:string|null;created_at:string}>;
};
function check(error:{message:string}|null){if(error) throw new Error(error.message);}
export async function listMembers(p:{search:string;status:string;role:string;communityId:string;sort:string;page:number;pageSize?:number}){
 const {data,error}=await supabase.rpc("fn_admin_list_members",{p_search:p.search||null,p_status:p.status||null,p_role:p.role||null,p_community_id:p.communityId||null,p_sort:p.sort,p_page:p.page,p_page_size:p.pageSize??20}); check(error);
 const v=data as {items?:MemberListItem[];total?:number;page?:number;page_size?:number}|null;
 return {items:v?.items??[],total:v?.total??0,page:v?.page??p.page,pageSize:v?.page_size??20};
}
export async function getMember(id:string){const {data,error}=await supabase.rpc("fn_admin_get_member",{p_customer_id:id});check(error);return data as MemberDetail;}
export async function updateMemberProfile(id:string,name:string,phone:string,reason:string){const {error}=await supabase.rpc("fn_admin_update_member_profile",{p_customer_id:id,p_name:name,p_phone:phone,p_reason:reason});check(error);}
export async function setMemberStatus(id:string,status:MemberStatus,reason:string){const {error}=await supabase.rpc("fn_admin_set_member_status",{p_customer_id:id,p_status:status,p_reason:reason});check(error);}
export async function decideMemberDeletion(id:string,decision:"approved"|"rejected"|"deferred",reason:string){const {error}=await supabase.rpc("fn_admin_decide_member_deletion",{p_customer_id:id,p_decision:decision,p_reason:reason});check(error);}
export async function addMemberNote(id:string,note:string,reason:string){const {error}=await supabase.rpc("fn_admin_add_member_note",{p_customer_id:id,p_note:note,p_reason:reason});check(error);}
