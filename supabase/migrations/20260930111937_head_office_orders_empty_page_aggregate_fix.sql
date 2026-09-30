-- #8 empty-page aggregate convergence
-- Reapply the final Production-verified list definition so an environment
-- interrupted between Production ledger versions still converges safely.

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
