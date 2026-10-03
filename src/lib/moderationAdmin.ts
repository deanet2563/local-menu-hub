import { supabase } from "@/lib/supabase";

export type ModerationTargetType = "member" | "shop" | "rider" | "shop_review";
export type ModerationCaseStatus = "open" | "in_review" | "escalated" | "resolved";
export type ModerationCategory =
  | "spam"
  | "scam_fraud_concern"
  | "harassment"
  | "impersonation"
  | "inappropriate_content"
  | "prohibited_listing"
  | "privacy_issue"
  | "misinformation_local_safety_concern"
  | "duplicate"
  | "other";

export type ModerationCaseListItem = {
  case_id: string;
  target_type: ModerationTargetType;
  target_id: string | null;
  target_label: string;
  community_id: string | null;
  status: ModerationCaseStatus;
  report_count: number;
  categories: ModerationCategory[];
  latest_report_at: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type ModerationCaseDetail = {
  case: {
    case_id: string;
    target_type: ModerationTargetType;
    target_id: string | null;
    community_id: string | null;
    status: ModerationCaseStatus;
    reviewed_by: string | null;
    reviewed_at: string | null;
    decision: string | null;
    created_at: string;
    updated_at: string;
  };
  target: Record<string, unknown>;
  target_owner: { customer_id?: string; name?: string | null; phone?: string | null } | null;
  reports: Array<{
    report_id: string;
    category: ModerationCategory;
    submitted_note: string | null;
    created_at: string;
    reporter: { customer_id: string | null; name: string | null };
  }>;
  events: Array<{
    event_id: string;
    action: string;
    reason: string | null;
    created_at: string;
    report_id: string | null;
    actor_customer_id: string | null;
    audit_id: number | null;
  }>;
  evidence: Array<{
    evidence_id: string;
    created_at: string;
    uploaded_by: string | null;
  }>;
  evidence_binary_access: "unavailable";
  audit_activity: Array<{
    audit_id: number;
    action: string;
    actor_role_key: string;
    actor_customer_id: string | null;
    reason: string | null;
    created_at: string;
  }>;
};

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function dateBound(value: string, endOfDay = false) {
  if (!value) return null;
  // Date inputs are Bangkok calendar dates; explicit +07:00 keeps RPC bounds
  // independent of the administrator's device timezone.
  const time = endOfDay ? "T23:59:59.999+07:00" : "T00:00:00.000+07:00";
  return new Date(`${value}${time}`).toISOString();
}

export async function listModerationCases(params: {
  search: string;
  targetType: string;
  communityId: string;
  status: string;
  category: string;
  createdFrom: string;
  createdTo: string;
  sort: string;
  page: number;
  pageSize?: number;
}) {
  const { data, error } = await supabase.rpc("fn_admin_list_moderation_cases", {
    p_search: params.search.trim() || null,
    p_target_type: params.targetType || null,
    p_community_id: params.communityId.trim() || null,
    p_status: params.status || null,
    p_category: params.category || null,
    p_created_from: dateBound(params.createdFrom),
    p_created_to: dateBound(params.createdTo, true),
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: params.pageSize ?? 20,
  });
  raise(error);
  const value = data as {
    items?: ModerationCaseListItem[];
    total?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
  } | null;
  return {
    items: value?.items ?? [],
    total: value?.total ?? 0,
    page: value?.page ?? params.page,
    pageSize: value?.page_size ?? params.pageSize ?? 20,
    totalPages: value?.total_pages ?? 0,
  };
}

export async function getModerationCase(caseId: string) {
  const { data, error } = await supabase.rpc("fn_admin_get_moderation_case", { p_case_id: caseId });
  raise(error);
  return data as ModerationCaseDetail;
}


export function formatModerationTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }).format(date);
}
