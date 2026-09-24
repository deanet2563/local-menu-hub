create or replace function public.fn_head_office_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_members boolean := public.fn_admin_has_permission('members.read');
  v_shops boolean := public.fn_admin_has_permission('shops.read');
  v_riders boolean := public.fn_admin_has_permission('riders.read');
  v_orders boolean := public.fn_admin_has_permission('orders.read');
  v_finance boolean := public.fn_admin_has_permission('finance.read');
  v_timezone constant text := 'Asia/Bangkok';
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if not (v_members or v_shops or v_riders or v_orders or v_finance) then
    raise exception 'permission denied: dashboard read';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'timezone', v_timezone,
    'metrics', jsonb_build_object(
      'total_members', case when v_members then jsonb_build_object('available', true, 'value', (select count(*) from public.customers)) else jsonb_build_object('available', false, 'value', null) end,
      'active_members', jsonb_build_object('available', false, 'value', null),
      'total_shops', case when v_shops then jsonb_build_object('available', true, 'value', (select count(*) from public.shops)) else jsonb_build_object('available', false, 'value', null) end,
      'active_shops', case when v_shops then jsonb_build_object('available', true, 'value', (select count(*) from public.shops where is_approved = true and coalesce(is_banned, false) = false)) else jsonb_build_object('available', false, 'value', null) end,
      'total_riders', case when v_riders then jsonb_build_object('available', true, 'value', (select count(*) from public.riders)) else jsonb_build_object('available', false, 'value', null) end,
      'riders_online', case when v_riders then jsonb_build_object('available', true, 'value', (select count(*) from public.riders where is_online = true and is_approved = true and coalesce(is_banned, false) = false)) else jsonb_build_object('available', false, 'value', null) end,
      'orders_today', case when v_orders then jsonb_build_object('available', true, 'value', (select count(*) from public.hub_orders where created_at >= v_today::timestamp at time zone 'Asia/Bangkok')) else jsonb_build_object('available', false, 'value', null) end,
      'orders_7_days', case when v_orders then jsonb_build_object('available', true, 'value', (select count(*) from public.hub_orders where created_at >= (v_today - 6)::timestamp at time zone 'Asia/Bangkok')) else jsonb_build_object('available', false, 'value', null) end,
      'paid_gmv_7_days', case when v_finance then jsonb_build_object('available', true, 'value', (select coalesce(sum(amount), 0) from public.sub_orders where payment_status::text = 'paid' and created_at >= (v_today - 6)::timestamp at time zone 'Asia/Bangkok')) else jsonb_build_object('available', false, 'value', null) end,
      'delivery_jobs', case when v_orders then jsonb_build_object('available', true, 'value', (select count(*) from public.sub_orders where fulfillment_type::text = 'delivery')) else jsonb_build_object('available', false, 'value', null) end,
      'total_communities', jsonb_build_object('available', false, 'value', null),
      'marketplace_listings', jsonb_build_object('available', false, 'value', null)
    ),
    'trends', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', d.day::date::text,
        'members', case when v_members then (select count(*) from public.customers c where (c.created_at at time zone 'Asia/Bangkok')::date = d.day::date) else null end,
        'shops', case when v_shops then (select count(*) from public.shops s where (s.created_at at time zone 'Asia/Bangkok')::date = d.day::date) else null end,
        'orders', case when v_orders then (select count(*) from public.hub_orders o where (o.created_at at time zone 'Asia/Bangkok')::date = d.day::date) else null end
      ) order by d.day), '[]'::jsonb)
      from generate_series(v_today - 6, v_today, interval '1 day') as d(day)
    ),
    'alerts', jsonb_build_object(
      'pending_shop_approvals', case when v_shops then jsonb_build_object('available', true, 'value', (select count(*) from public.shops where is_approved = false and coalesce(is_banned, false) = false)) else jsonb_build_object('available', false, 'value', null) end,
      'pending_rider_approvals', case when v_riders then jsonb_build_object('available', true, 'value', (select count(*) from public.riders where is_approved = false and coalesce(is_banned, false) = false)) else jsonb_build_object('available', false, 'value', null) end,
      'unresolved_reports', jsonb_build_object('available', false, 'value', null),
      'abnormal_orders', case when v_orders then jsonb_build_object('available', true, 'value', (select count(*) from public.sub_orders where order_status::text not in ('completed', 'cancelled') and created_at < now() - interval '24 hours')) else jsonb_build_object('available', false, 'value', null) end,
      'failed_deliveries', case when v_orders then jsonb_build_object('available', true, 'value', (select count(*) from public.sub_orders where delivery_status::text = 'failed')) else jsonb_build_object('available', false, 'value', null) end
    )
  );
end;
$function$;

revoke all on function public.fn_head_office_dashboard() from public;
revoke all on function public.fn_head_office_dashboard() from anon;
grant execute on function public.fn_head_office_dashboard() to authenticated;
grant execute on function public.fn_head_office_dashboard() to service_role;
