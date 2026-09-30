-- #8 MyTree Head Office — Orders & Commerce Control Center
-- Final Production-verified canonical read model.
-- Requires the existing Head Office RBAC foundation migrations already in this repo.

CREATE OR REPLACE FUNCTION public.fn_admin_get_order(p_sub_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_so public.sub_orders%rowtype;
  v_ho public.hub_orders%rowtype;
  v_shop public.shops%rowtype;
  v_customer public.customers%rowtype;
  v_rider public.riders%rowtype;
  v_can_members boolean;
  v_can_riders boolean;
  v_can_finance boolean;
  v_can_audit boolean;
  v_items jsonb;
  v_delivery_events jsonb;
  v_timeline jsonb;
  v_audit jsonb := '[]'::jsonb;
  v_warnings text[];
begin
  if not public.fn_admin_has_permission('orders.read') then
    raise exception 'permission denied: orders.read';
  end if;

  v_can_members := public.fn_admin_has_permission('members.read');
  v_can_riders := public.fn_admin_has_permission('riders.read');
  v_can_finance := public.fn_admin_has_permission('finance.read');
  v_can_audit := public.fn_admin_has_permission('system.audit.read');

  select * into v_so
  from public.sub_orders
  where sub_id = p_sub_id;

  if not found then
    raise exception 'order not found';
  end if;

  select * into v_ho from public.hub_orders where order_id = v_so.order_id;
  select * into v_shop from public.shops where shop_id = v_so.shop_id;

  if v_ho.customer_id is not null then
    select * into v_customer from public.customers where id = v_ho.customer_id;
  end if;

  if v_so.assigned_rider_id is not null then
    select * into v_rider from public.riders where id = v_so.assigned_rider_id;
  end if;

  v_warnings := array_remove(array[
    case when v_so.fulfillment_type::text = 'delivery'
      and v_so.delivery_status::text in ('rider_called','picked_up','delivered')
      and v_so.assigned_rider_id is null then 'delivery_assignment_missing' end,
    case when v_so.assigned_rider_id is not null
      and v_so.delivery_status::text in ('not_needed','needs_rider') then 'delivery_assignment_state_mismatch' end,
    case when v_so.delivery_status::text = 'rider_called'
      and v_so.rider_called_at is null then 'rider_called_timestamp_missing' end,
    case when v_so.delivery_status::text = 'picked_up'
      and v_so.picked_up_at is null then 'picked_up_timestamp_missing' end,
    case when v_so.delivery_status::text = 'delivered'
      and v_so.delivered_at is null then 'delivered_timestamp_missing' end,
    case when v_so.delivered_at is not null
      and v_so.delivery_status::text <> 'delivered' then 'delivered_state_mismatch' end,
    case when v_so.payment_status::text = 'paid'
      and v_so.paid_at is null then 'paid_timestamp_missing' end,
    case when v_so.payment_status::text = 'refunded'
      and v_so.refunded_at is null then 'refunded_timestamp_missing' end,
    case when v_so.order_status::text = 'completed'
      and v_so.completed_at is null then 'completed_timestamp_missing' end,
    case when v_so.order_status::text = 'cancelled'
      and v_so.cancelled_at is null then 'cancelled_timestamp_missing' end,
    case when v_so.fulfillment_type::text = 'pickup'
      and v_so.delivery_status::text <> 'not_needed' then 'pickup_delivery_state_mismatch' end,
    case when v_so.fulfillment_type::text = 'delivery'
      and (v_so.delivery_destination_lat is null or v_so.delivery_destination_lng is null)
      then 'delivery_destination_missing' end,
    case when v_so.order_status::text = 'cancelled'
      and v_so.payment_status::text = 'paid' then 'cancelled_but_paid' end,
    case when v_so.fulfillment_type::text = 'delivery'
      and v_so.delivery_status::text = 'delivered'
      and v_so.order_status::text not in ('completed','cancelled') then 'delivered_order_not_closed' end
  ], null)::text[];

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'name', oi.item_name_snapshot,
        'qty', oi.qty,
        'unit_price', oi.unit_price_snapshot,
        'line_total', oi.line_total,
        'line_kind', oi.line_kind,
        'bundle_id', oi.bundle_id,
        'item_note', oi.item_note,
        'configuration_snapshot', oi.configuration_snapshot
      )
      order by oi.created_at, oi.id
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.sub_id = p_sub_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event_id', e.event_id,
        'event_type', e.event_type,
        'from_delivery_status', e.from_delivery_status,
        'to_delivery_status', e.to_delivery_status,
        'previous_assigned_rider_id', e.previous_assigned_rider_id,
        'assigned_rider_id', e.assigned_rider_id,
        'actor_customer_id', case when v_can_audit then e.actor_customer_id else null end,
        'from_order_status', e.from_order_status,
        'to_order_status', e.to_order_status,
        'cancelled_reason', e.cancelled_reason,
        'reason_code', e.reason_code,
        'reason_note', e.reason_note,
        'occurred_at', e.occurred_at
      )
      order by e.occurred_at, e.event_id
    ),
    '[]'::jsonb
  )
  into v_delivery_events
  from public.rider_delivery_events e
  where e.sub_id = p_sub_id;

  with evidence as (
    select 'order.created'::text event_type, v_so.created_at occurred_at, 'state_timestamp'::text source, null::text note
    union all select 'order.confirmed', v_so.confirmed_at, 'state_timestamp', null where v_so.confirmed_at is not null
    union all select 'order.preparing', v_so.preparing_at, 'state_timestamp', null where v_so.preparing_at is not null
    union all select 'order.completed', v_so.completed_at, 'state_timestamp', null where v_so.completed_at is not null
    union all select 'order.cancelled', v_so.cancelled_at, 'state_timestamp', v_so.cancelled_reason where v_so.cancelled_at is not null
    union all select 'payment.pending', v_so.payment_pending_at, 'state_timestamp', null where v_so.payment_pending_at is not null
    union all select 'payment.paid', v_so.paid_at, 'state_timestamp', null where v_so.paid_at is not null
    union all select 'payment.refunded', v_so.refunded_at, 'state_timestamp', null where v_so.refunded_at is not null
    union all
      select 'delivery.' || e.event_type, e.occurred_at, 'rider_delivery_events',
             coalesce(e.reason_note, e.cancelled_reason, e.reason_code)
      from public.rider_delivery_events e
      where e.sub_id = p_sub_id
    union all
      select 'delivery.assigned', v_so.rider_called_at, 'state_timestamp_fallback', null
      where v_so.rider_called_at is not null
        and not exists (
          select 1 from public.rider_delivery_events e
          where e.sub_id=p_sub_id and e.event_type in ('assigned','accepted')
        )
    union all
      select 'delivery.picked_up', v_so.picked_up_at, 'state_timestamp_fallback', null
      where v_so.picked_up_at is not null
        and not exists (
          select 1 from public.rider_delivery_events e
          where e.sub_id=p_sub_id and e.event_type='picked_up'
        )
    union all
      select 'delivery.delivered', v_so.delivered_at, 'state_timestamp_fallback', null
      where v_so.delivered_at is not null
        and not exists (
          select 1 from public.rider_delivery_events e
          where e.sub_id=p_sub_id and e.event_type='delivered'
        )
    union all
      select 'delivery.failed', v_so.delivery_failed_at, 'state_timestamp_fallback', v_so.delivery_failed_reason
      where v_so.delivery_failed_at is not null
        and not exists (
          select 1 from public.rider_delivery_events e
          where e.sub_id=p_sub_id and e.event_type='failed'
        )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event_type', event_type,
        'occurred_at', occurred_at,
        'source', source,
        'note', note
      )
      order by occurred_at, event_type
    ),
    '[]'::jsonb
  )
  into v_timeline
  from evidence
  where occurred_at is not null;

  if v_can_audit then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'audit_id', a.audit_id,
          'actor_customer_id', a.actor_customer_id,
          'actor_role_key', a.actor_role_key,
          'action', a.action,
          'target_type', a.target_type,
          'target_id', a.target_id,
          'before_state', a.before_state,
          'after_state', a.after_state,
          'reason', a.reason,
          'metadata', a.metadata,
          'created_at', a.created_at
        )
        order by a.created_at desc, a.audit_id desc
      ),
      '[]'::jsonb
    )
    into v_audit
    from public.admin_audit_log a
    where a.target_id in (v_so.sub_id::text, v_so.order_id::text)
      and a.target_type in ('order','sub_order','suborder');
  end if;

  return jsonb_build_object(
    'identity', jsonb_build_object(
      'sub_id', v_so.sub_id,
      'order_id', v_so.order_id,
      'created_at', v_so.created_at,
      'requested_for', v_so.requested_for,
      'source', v_so.source,
      'hub_status', v_ho.status
    ),
    'customer', jsonb_build_object(
      'customer_id', v_ho.customer_id,
      'name', case when v_can_members then v_customer.name else null end,
      'phone', case when v_can_members then v_customer.phone else null end,
      'details_visible', v_can_members
    ),
    'shop', jsonb_build_object(
      'shop_id', v_so.shop_id,
      'name', v_shop.name,
      'phone', v_shop.phone,
      'address', v_shop.address
    ),
    'items', v_items,
    'amounts', jsonb_build_object(
      'item_amount', v_so.amount,
      'hub_item_total', v_ho.total,
      'finance_visible', v_can_finance,
      'delivery_fee', case when v_can_finance then v_so.delivery_fee else null end,
      'calculated_delivery_fee', case when v_can_finance then v_so.calculated_delivery_fee else null end,
      'delivery_fee_rate_per_km', case when v_can_finance then v_so.delivery_fee_rate_per_km else null end,
      'delivery_fee_payer', case when v_can_finance then v_so.delivery_fee_payer else null end,
      'customer_delivery_charge', case when v_can_finance then v_so.customer_delivery_charge else null end
    ),
    'payment', jsonb_build_object(
      'method', v_so.payment_method,
      'status', v_so.payment_status,
      'payment_pending_at', v_so.payment_pending_at,
      'paid_at', v_so.paid_at,
      'refunded_at', v_so.refunded_at,
      'slip_present', v_so.payment_slip_url is not null,
      'slip_url', case when v_can_finance then v_so.payment_slip_url else null end,
      'shop_confirmation_field_available', false,
      'settlement_state_available', false
    ),
    'fulfillment', jsonb_build_object(
      'type', v_so.fulfillment_type,
      'delivery_address', case when v_can_members then v_so.delivery_address else null end,
      'customer_note', case when v_can_members then v_so.customer_note else null end,
      'destination_lat', case when v_can_members then v_so.delivery_destination_lat else null end,
      'destination_lng', case when v_can_members then v_so.delivery_destination_lng else null end,
      'location_source', case when v_can_members then v_so.delivery_location_source else null end,
      'location_accuracy_m', case when v_can_members then v_so.delivery_location_accuracy_m else null end
    ),
    'order_state', jsonb_build_object(
      'status', v_so.order_status,
      'confirmed_at', v_so.confirmed_at,
      'preparing_at', v_so.preparing_at,
      'completed_at', v_so.completed_at,
      'cancelled_at', v_so.cancelled_at,
      'cancelled_reason', v_so.cancelled_reason
    ),
    'delivery', jsonb_build_object(
      'status', v_so.delivery_status,
      'assigned_rider_id', v_so.assigned_rider_id,
      'rider_name', case when v_can_riders then v_rider.name else null end,
      'rider_phone', case when v_can_riders then v_rider.phone else null end,
      'rider_details_visible', v_can_riders,
      'rider_called_at', v_so.rider_called_at,
      'picked_up_at', v_so.picked_up_at,
      'delivered_at', v_so.delivered_at,
      'failed_at', v_so.delivery_failed_at,
      'failed_reason', v_so.delivery_failed_reason,
      'retry_count', v_so.rider_retry_count,
      'proof_present', coalesce(v_so.delivery_proof_path, v_so.delivery_photo_url) is not null,
      'proof_path', case when v_can_riders then v_so.delivery_proof_path else null end,
      'proof_url', case when v_can_riders then v_so.delivery_photo_url else null end,
      'distance_km', case when v_can_finance then v_so.delivery_distance_km else null end
    ),
    'delivery_events', v_delivery_events,
    'timeline', v_timeline,
    'warnings', to_jsonb(v_warnings),
    'audit', v_audit,
    'capabilities', jsonb_build_object(
      'members_read', v_can_members,
      'riders_read', v_can_riders,
      'finance_read', v_can_finance,
      'audit_read', v_can_audit,
      'order_actions_available', false
    ),
    'intervention', jsonb_build_object(
      'available', false,
      'reason', 'No approved Head Office order mutation contract exists in Production; this module is read-first.'
    ),
    'semantics', jsonb_build_object(
      'row_grain', 'sub_order',
      'item_amount', 'sub_orders.amount is the server-priced item total for this shop',
      'hub_item_total', 'hub_orders.total is the sum of sub_orders.amount across shops',
      'customer_delivery_charge_separate', true,
      'platform_holds_delivery_money', false,
      'gmv_defined', false
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_admin_list_orders(p_search text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_shop_id text DEFAULT NULL::text, p_customer_id uuid DEFAULT NULL::uuid, p_order_status text DEFAULT NULL::text, p_payment_status text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_fulfillment_type text DEFAULT NULL::text, p_delivery_status text DEFAULT NULL::text, p_rider_id uuid DEFAULT NULL::uuid, p_abnormal_only boolean DEFAULT false, p_sort text DEFAULT 'created_desc'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_offset integer;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_can_members boolean;
  v_can_riders boolean;
  v_can_finance boolean;
  v_items jsonb;
  v_total bigint;
begin
  if not public.fn_admin_has_permission('orders.read') then
    raise exception 'permission denied: orders.read';
  end if;

  if p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'invalid pagination';
  end if;

  if coalesce(p_sort, 'created_desc') not in ('created_desc','created_asc','activity_desc','amount_desc','amount_asc') then
    raise exception 'invalid sort';
  end if;

  v_can_members := public.fn_admin_has_permission('members.read');
  v_can_riders := public.fn_admin_has_permission('riders.read');
  v_can_finance := public.fn_admin_has_permission('finance.read');
  v_offset := (v_page - 1) * v_size;

  with base as (
    select
      so.sub_id,
      so.order_id,
      so.shop_id,
      sh.name as shop_name,
      ho.customer_id,
      case when v_can_members then c.name else null end as customer_name,
      case when v_can_members then c.phone else null end as customer_phone,
      so.source,
      so.fulfillment_type::text as fulfillment_type,
      so.payment_method::text as payment_method,
      so.payment_status::text as payment_status,
      so.order_status::text as order_status,
      so.delivery_status::text as delivery_status,
      ho.status::text as hub_status,
      so.assigned_rider_id,
      case when v_can_riders then r.name else null end as rider_name,
      case when v_can_riders then r.phone else null end as rider_phone,
      so.amount,
      so.payment_slip_url is not null as payment_slip_present,
      so.created_at,
      greatest(
        so.created_at,
        coalesce(so.payment_pending_at, so.created_at),
        coalesce(so.confirmed_at, so.created_at),
        coalesce(so.preparing_at, so.created_at),
        coalesce(so.completed_at, so.created_at),
        coalesce(so.cancelled_at, so.created_at),
        coalesce(so.paid_at, so.created_at),
        coalesce(so.refunded_at, so.created_at),
        coalesce(so.rider_called_at, so.created_at),
        coalesce(so.picked_up_at, so.created_at),
        coalesce(so.delivered_at, so.created_at),
        coalesce(so.delivery_failed_at, so.created_at)
      ) as last_activity_at,
      array_remove(array[
        case when so.fulfillment_type::text = 'delivery'
          and so.delivery_status::text in ('rider_called','picked_up','delivered')
          and so.assigned_rider_id is null then 'delivery_assignment_missing' end,
        case when so.assigned_rider_id is not null
          and so.delivery_status::text in ('not_needed','needs_rider') then 'delivery_assignment_state_mismatch' end,
        case when so.delivery_status::text = 'rider_called'
          and so.rider_called_at is null then 'rider_called_timestamp_missing' end,
        case when so.delivery_status::text = 'picked_up'
          and so.picked_up_at is null then 'picked_up_timestamp_missing' end,
        case when so.delivery_status::text = 'delivered'
          and so.delivered_at is null then 'delivered_timestamp_missing' end,
        case when so.delivered_at is not null
          and so.delivery_status::text <> 'delivered' then 'delivered_state_mismatch' end,
        case when so.payment_status::text = 'paid'
          and so.paid_at is null then 'paid_timestamp_missing' end,
        case when so.payment_status::text = 'refunded'
          and so.refunded_at is null then 'refunded_timestamp_missing' end,
        case when so.order_status::text = 'completed'
          and so.completed_at is null then 'completed_timestamp_missing' end,
        case when so.order_status::text = 'cancelled'
          and so.cancelled_at is null then 'cancelled_timestamp_missing' end,
        case when so.fulfillment_type::text = 'pickup'
          and so.delivery_status::text <> 'not_needed' then 'pickup_delivery_state_mismatch' end,
        case when so.fulfillment_type::text = 'delivery'
          and (so.delivery_destination_lat is null or so.delivery_destination_lng is null)
          then 'delivery_destination_missing' end,
        case when so.order_status::text = 'cancelled'
          and so.payment_status::text = 'paid' then 'cancelled_but_paid' end,
        case when so.fulfillment_type::text = 'delivery'
          and so.delivery_status::text = 'delivered'
          and so.order_status::text not in ('completed','cancelled') then 'delivered_order_not_closed' end
      ], null)::text[] as warning_codes
    from public.sub_orders so
    join public.hub_orders ho on ho.order_id = so.order_id
    left join public.customers c on c.id = ho.customer_id
    join public.shops sh on sh.shop_id = so.shop_id
    left join public.riders r on r.id = so.assigned_rider_id
    where
      (p_date_from is null or (so.created_at at time zone 'Asia/Bangkok')::date >= p_date_from)
      and (p_date_to is null or (so.created_at at time zone 'Asia/Bangkok')::date <= p_date_to)
      and (nullif(btrim(coalesce(p_shop_id,'')),'') is null or so.shop_id = p_shop_id)
      and (p_customer_id is null or ho.customer_id = p_customer_id)
      and (nullif(btrim(coalesce(p_order_status,'')),'') is null or so.order_status::text = p_order_status)
      and (nullif(btrim(coalesce(p_payment_status,'')),'') is null or so.payment_status::text = p_payment_status)
      and (nullif(btrim(coalesce(p_payment_method,'')),'') is null or so.payment_method::text = p_payment_method)
      and (nullif(btrim(coalesce(p_fulfillment_type,'')),'') is null or so.fulfillment_type::text = p_fulfillment_type)
      and (nullif(btrim(coalesce(p_delivery_status,'')),'') is null or so.delivery_status::text = p_delivery_status)
      and (p_rider_id is null or so.assigned_rider_id = p_rider_id)
      and (
        v_search is null
        or so.sub_id::text ilike '%' || v_search || '%'
        or so.order_id::text ilike '%' || v_search || '%'
        or so.shop_id ilike '%' || v_search || '%'
        or sh.name ilike '%' || v_search || '%'
        or ho.customer_id::text ilike '%' || v_search || '%'
        or (v_can_members and (coalesce(c.name,'') ilike '%' || v_search || '%' or coalesce(c.phone,'') ilike '%' || v_search || '%'))
        or so.assigned_rider_id::text ilike '%' || v_search || '%'
        or (v_can_riders and (coalesce(r.name,'') ilike '%' || v_search || '%' or coalesce(r.phone,'') ilike '%' || v_search || '%'))
      )
  ),
  filtered as (
    select *
    from base
    where not coalesce(p_abnormal_only,false) or cardinality(warning_codes) > 0
  ),
  totals as (
    select count(*)::bigint as total from filtered
  ),
  numbered as (
    select
      f.*,
      row_number() over (
        order by
          case when p_sort='created_asc' then f.created_at end asc,
          case when p_sort='activity_desc' then f.last_activity_at end desc,
          case when p_sort='amount_desc' then f.amount end desc,
          case when p_sort='amount_asc' then f.amount end asc,
          f.created_at desc,
          f.sub_id desc
      ) as row_no
    from filtered f
  ),
  paged as (
    select *
    from numbered
    where row_no > v_offset and row_no <= v_offset + v_size
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'sub_id', p.sub_id,
          'order_id', p.order_id,
          'shop_id', p.shop_id,
          'shop_name', p.shop_name,
          'customer_id', p.customer_id,
          'customer_name', p.customer_name,
          'customer_phone', p.customer_phone,
          'source', p.source,
          'fulfillment_type', p.fulfillment_type,
          'payment_method', p.payment_method,
          'payment_status', p.payment_status,
          'order_status', p.order_status,
          'hub_status', p.hub_status,
          'delivery_status', p.delivery_status,
          'assigned_rider_id', p.assigned_rider_id,
          'rider_name', p.rider_name,
          'rider_phone', p.rider_phone,
          'item_amount', p.amount,
          'payment_slip_present', p.payment_slip_present,
          'warnings', to_jsonb(p.warning_codes),
          'warning_count', cardinality(p.warning_codes),
          'created_at', p.created_at,
          'last_activity_at', p.last_activity_at
        )
        order by p.row_no
      ) filter (where p.sub_id is not null),
      '[]'::jsonb
    ),
    max(t.total)
  into v_items, v_total
  from totals t
  left join paged p on true;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_size,
    'capabilities', jsonb_build_object(
      'members_read', v_can_members,
      'riders_read', v_can_riders,
      'finance_read', v_can_finance,
      'order_actions_available', false,
      'abnormal_thresholds_configured', false
    ),
    'semantics', jsonb_build_object(
      'row_grain', 'sub_order',
      'item_amount', 'sub_orders.amount = server-priced item total for this shop',
      'hub_total', 'sum of sub_orders.amount for the hub order; not delivery charge or settlement',
      'delivery_charge_separate', true,
      'gmv_defined', false
    )
  );
end;
$function$;

revoke all on function public.fn_admin_list_orders(text,date,date,text,uuid,text,text,text,text,text,uuid,boolean,text,integer,integer) from public, anon;
grant execute on function public.fn_admin_list_orders(text,date,date,text,uuid,text,text,text,text,text,uuid,boolean,text,integer,integer) to authenticated, service_role;

revoke all on function public.fn_admin_get_order(uuid) from public, anon;
grant execute on function public.fn_admin_get_order(uuid) to authenticated, service_role;
