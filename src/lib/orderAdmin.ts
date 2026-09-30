import { supabase } from "@/lib/supabase";

export type OrderAdminCapabilities = {
  members_read: boolean;
  riders_read: boolean;
  finance_read: boolean;
  audit_read?: boolean;
  order_actions_available: boolean;
  abnormal_thresholds_configured?: boolean;
};

export type OrderListItem = {
  sub_id: string;
  order_id: string;
  shop_id: string;
  shop_name: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  source: string;
  fulfillment_type: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  hub_status: string;
  delivery_status: string;
  assigned_rider_id: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  item_amount: number | string;
  payment_slip_present: boolean;
  warnings: string[];
  warning_count: number;
  created_at: string;
  last_activity_at: string;
};

export type OrderListResponse = {
  items: OrderListItem[];
  total: number;
  page: number;
  page_size: number;
  capabilities: OrderAdminCapabilities;
  semantics: {
    row_grain: "sub_order";
    item_amount: string;
    hub_total: string;
    delivery_charge_separate: boolean;
    gmv_defined: boolean;
  };
};

export type OrderTimelineEntry = {
  event_type: string;
  occurred_at: string;
  source: "state_timestamp" | "state_timestamp_fallback" | "rider_delivery_events" | string;
  note: string | null;
};

export type OrderDeliveryEvent = {
  event_id: number;
  event_type: string;
  from_delivery_status: string | null;
  to_delivery_status: string | null;
  previous_assigned_rider_id: string | null;
  assigned_rider_id: string | null;
  actor_customer_id: string | null;
  from_order_status: string | null;
  to_order_status: string | null;
  cancelled_reason: string | null;
  reason_code: string | null;
  reason_note: string | null;
  occurred_at: string;
};

export type OrderAuditEntry = {
  audit_id: number;
  actor_customer_id: string;
  actor_role_key: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before_state: unknown;
  after_state: unknown;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type OrderDetail = {
  identity: {
    sub_id: string;
    order_id: string;
    created_at: string;
    requested_for: string | null;
    source: string;
    hub_status: string;
  };
  customer: {
    customer_id: string | null;
    name: string | null;
    phone: string | null;
    details_visible: boolean;
  };
  shop: {
    shop_id: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  items: Array<{
    id: string;
    name: string;
    qty: number;
    unit_price: number | string;
    line_total: number | string | null;
    line_kind: string;
    bundle_id: string | null;
    item_note: string | null;
    configuration_snapshot: unknown;
  }>;
  amounts: {
    item_amount: number | string;
    hub_item_total: number | string;
    finance_visible: boolean;
    delivery_fee: number | string | null;
    calculated_delivery_fee: number | string | null;
    delivery_fee_rate_per_km: number | string | null;
    delivery_fee_payer: string | null;
    customer_delivery_charge: number | string | null;
  };
  payment: {
    method: string;
    status: string;
    payment_pending_at: string | null;
    paid_at: string | null;
    refunded_at: string | null;
    slip_present: boolean;
    slip_url: string | null;
    shop_confirmation_field_available: boolean;
    settlement_state_available: boolean;
  };
  fulfillment: {
    type: string;
    delivery_address: string | null;
    customer_note: string | null;
    destination_lat: number | null;
    destination_lng: number | null;
    location_source: string | null;
    location_accuracy_m: number | string | null;
  };
  order_state: {
    status: string;
    confirmed_at: string | null;
    preparing_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    cancelled_reason: string | null;
  };
  delivery: {
    status: string;
    assigned_rider_id: string | null;
    rider_name: string | null;
    rider_phone: string | null;
    rider_details_visible: boolean;
    rider_called_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
    failed_at: string | null;
    failed_reason: string | null;
    retry_count: number;
    proof_present: boolean;
    proof_path: string | null;
    proof_url: string | null;
    distance_km: number | string | null;
  };
  delivery_events: OrderDeliveryEvent[];
  timeline: OrderTimelineEntry[];
  warnings: string[];
  audit: OrderAuditEntry[];
  capabilities: OrderAdminCapabilities;
  intervention: {
    available: boolean;
    reason: string;
  };
  semantics: {
    row_grain: "sub_order";
    item_amount: string;
    hub_item_total: string;
    customer_delivery_charge_separate: boolean;
    platform_holds_delivery_money: boolean;
    gmv_defined: boolean;
  };
};

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function uuidOrNull(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(trimmed)) {
    throw new Error(`${label} ต้องเป็น UUID ที่ถูกต้อง`);
  }
  return trimmed;
}

export async function listOrders(params: {
  search: string;
  dateFrom: string;
  dateTo: string;
  shopId: string;
  customerId: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType: string;
  deliveryStatus: string;
  riderId: string;
  abnormalOnly: boolean;
  sort: string;
  page: number;
  pageSize?: number;
}) {
  const { data, error } = await supabase.rpc("fn_admin_list_orders", {
    p_search: params.search.trim() || null,
    p_date_from: params.dateFrom || null,
    p_date_to: params.dateTo || null,
    p_shop_id: params.shopId.trim() || null,
    p_customer_id: uuidOrNull(params.customerId, "Customer ID"),
    p_order_status: params.orderStatus || null,
    p_payment_status: params.paymentStatus || null,
    p_payment_method: params.paymentMethod || null,
    p_fulfillment_type: params.fulfillmentType || null,
    p_delivery_status: params.deliveryStatus || null,
    p_rider_id: uuidOrNull(params.riderId, "Rider ID"),
    p_abnormal_only: params.abnormalOnly,
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: params.pageSize ?? 25,
  });
  check(error);

  const value = data as OrderListResponse | null;
  return {
    items: value?.items ?? [],
    total: value?.total ?? 0,
    page: value?.page ?? params.page,
    pageSize: value?.page_size ?? params.pageSize ?? 25,
    capabilities: value?.capabilities ?? {
      members_read: false,
      riders_read: false,
      finance_read: false,
      order_actions_available: false,
      abnormal_thresholds_configured: false,
    },
    semantics: value?.semantics,
  };
}

export async function getOrder(subId: string) {
  const { data, error } = await supabase.rpc("fn_admin_get_order", {
    p_sub_id: subId,
  });
  check(error);
  return data as OrderDetail;
}
