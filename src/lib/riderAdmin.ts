import { supabase } from "@/lib/supabase";

export type RiderVerificationState = "verified" | "unverified" | "not_required";

export type RiderCurrentJob = {
  sub_id: string;
  shop_id: string;
  shop_name: string;
  delivery_status: string;
  rider_called_at: string | null;
  picked_up_at: string | null;
};

export type RiderListItem = {
  rider_id: string;
  customer_id: string;
  name: string;
  phone: string;
  vehicle_type: string | null;
  rider_class: string;
  is_approved: boolean;
  verification_state: RiderVerificationState;
  is_banned: boolean;
  is_online: boolean;
  offers_delivery: boolean;
  created_at: string | null;
  location_updated_at: string | null;
  current_job: RiderCurrentJob | null;
};

export type RiderMetric = {
  available: boolean;
  value: number | string | null;
  reason?: string;
};

export type RiderDetail = {
  identity: {
    rider_id: string;
    customer_id: string;
    name: string;
    phone: string;
    created_at: string | null;
  };
  profile: {
    rider_class: string;
    vehicle_type: string | null;
    plate_number: string | null;
    win_registration_no: string | null;
    win_zone: string | null;
    offers_delivery: boolean;
    verification_state: RiderVerificationState;
    verified_at: string | null;
    verified_by: string | null;
  };
  operational: {
    is_online: boolean;
    location_updated_at: string | null;
    location_age_seconds: number | null;
    precise_location: { lat: number | string; lng: number | string; updated_at: string | null } | null;
  };
  governance: {
    is_approved: boolean;
    is_banned: boolean;
    banned_reason: string | null;
    banned_at: string | null;
    banned_by: string | null;
    deletion_requested_at: string | null;
    deletion_reason: string | null;
  };
  current_job: {
    sub_id: string;
    shop_id: string;
    shop_name: string;
    order_status: string;
    delivery_status: string;
    rider_called_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
    proof_present: boolean;
    elapsed_seconds: number;
  } | null;
  recent_jobs: Array<{
    sub_id: string;
    shop_id: string;
    shop_name: string;
    order_status: string;
    delivery_status: string;
    rider_called_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
    proof_present: boolean;
    sort_at?: string | null;
  }>;
  events: Array<{
    event_id: number;
    sub_id: string;
    event_type: string;
    from_delivery_status: string | null;
    to_delivery_status: string | null;
    previous_assigned_rider_id: string | null;
    assigned_rider_id: string | null;
    reason_code: string | null;
    reason_note: string | null;
    occurred_at: string;
  }>;
  kpi: {
    coverage_started_at: string | null;
    jobs_offered: RiderMetric;
    jobs_accepted: RiderMetric;
    completed: RiderMetric;
    rider_cancellations: RiderMetric;
    completion_rate: RiderMetric;
    reassignments: RiderMetric;
    serious_incidents: RiderMetric;
    accept_to_pickup_seconds: RiderMetric;
    pickup_to_delivery_seconds: RiderMetric;
  };
  audit: Array<{
    audit_id: number;
    actor_customer_id: string;
    actor_role_key: string | null;
    action: string;
    reason: string | null;
    created_at: string;
  }>;
  capabilities: {
    verification_evidence: boolean;
    verification_rejection: boolean;
    verification_expiry: boolean;
    deletion_approval: boolean;
    precise_location: boolean;
  };
};

export type RiderLifecycleAction =
  | "approve"
  | "verify"
  | "ban"
  | "unban"
  | "deletion_reject";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listRiders(params: {
  search: string;
  approval: string;
  verification: string;
  online: string;
  riderClass: string;
  offersDelivery: string;
  sort: string;
  page: number;
}) {
  const { data, error } = await supabase.rpc("fn_admin_list_riders", {
    p_search: params.search || null,
    p_approval: params.approval || null,
    p_verification: params.verification || null,
    p_online: params.online || null,
    p_rider_class: params.riderClass || null,
    p_offers_delivery: params.offersDelivery || null,
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: 20,
  });
  check(error);
  const value = data as {
    items?: RiderListItem[];
    total?: number;
    page?: number;
    page_size?: number;
  } | null;
  return {
    items: value?.items ?? [],
    total: value?.total ?? 0,
    page: value?.page ?? params.page,
    pageSize: value?.page_size ?? 20,
  };
}

export async function getRider(id: string) {
  const { data, error } = await supabase.rpc("fn_admin_get_rider", {
    p_rider_id: id,
  });
  check(error);
  return data as RiderDetail;
}

export async function riderLifecycle(
  id: string,
  action: RiderLifecycleAction,
  reason: string,
) {
  const { error } = await supabase.rpc("fn_admin_rider_lifecycle", {
    p_rider_id: id,
    p_action: action,
    p_reason: reason,
  });
  check(error);
}
