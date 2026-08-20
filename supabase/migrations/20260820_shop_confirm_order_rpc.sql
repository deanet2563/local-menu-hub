-- Allow the trusted Worker service-role to confirm a pending shop order without
-- being rejected by trg_0_guard_rider_delivery_update. The trigger deliberately
-- requires the session flag mytree.admin_action for privileged server-side
-- changes.

create or replace function public.fn_shop_confirm_order(p_sub_id uuid)
returns table(sub_id uuid, order_id uuid, shop_id text, order_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform set_config('mytree.admin_action', 'true', true);

  return query
  update public.sub_orders so
     set order_status = 'confirmed'
   where so.sub_id = p_sub_id
     and so.order_status = 'pending'
  returning so.sub_id, so.order_id, so.shop_id, so.order_status::text;
end;
$function$;

revoke all on function public.fn_shop_confirm_order(uuid) from public;
revoke execute on function public.fn_shop_confirm_order(uuid) from anon, authenticated;
grant execute on function public.fn_shop_confirm_order(uuid) to service_role;
