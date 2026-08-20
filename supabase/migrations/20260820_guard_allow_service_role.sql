-- The delivery guard protects browser/mobile callers, but trusted Worker
-- operations use the Supabase service_role JWT. Service role already has full
-- database privilege; let it pass the trigger explicitly so server-side order
-- transitions such as pending -> confirmed are not rejected.

create or replace function public.fn_guard_rider_delivery_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare v_is_staff boolean; v_is_rider boolean; v_is_customer boolean;
begin
  if current_setting('mytree.admin_action', true) = 'true'
     or auth.role() = 'service_role' then
    return new;
  end if;

  select exists(
           select 1 from shop_staff
           where shop_id = old.shop_id
             and customer_id = (auth.jwt() ->> 'customer_id')::uuid
         )
      or exists(
           select 1 from platform_admins
           where customer_id = (auth.jwt() ->> 'customer_id')::uuid
         )
    into v_is_staff;

  if v_is_staff then return new; end if;

  v_is_rider := (old.assigned_rider_id is not null and old.assigned_rider_id = fn_my_rider_id());
  if v_is_rider then
    if new.order_id is distinct from old.order_id
       or new.shop_id is distinct from old.shop_id
       or new.items_json is distinct from old.items_json
       or new.amount is distinct from old.amount
       or new.order_status is distinct from old.order_status
       or new.payment_status is distinct from old.payment_status
       or new.payment_method is distinct from old.payment_method
       or new.assigned_rider_id is distinct from old.assigned_rider_id
       or new.delivery_address is distinct from old.delivery_address
       or new.payment_slip_url is distinct from old.payment_slip_url
    then
      raise exception 'riders may only update delivery_status and delivery_photo_url';
    end if;

    if new.delivery_status is distinct from old.delivery_status then
      if not ((old.delivery_status = 'rider_called' and new.delivery_status = 'picked_up')
              or (old.delivery_status = 'picked_up' and new.delivery_status = 'delivered')) then
        raise exception 'invalid delivery status transition for rider';
      end if;
      if new.delivery_status = 'delivered' and new.delivery_photo_url is null then
        raise exception 'a delivery photo is required to mark as delivered';
      end if;
    end if;
    return new;
  end if;

  v_is_customer := (old.order_id in (select fn_my_hub_order_ids()));
  if v_is_customer then
    if new.order_id is distinct from old.order_id
       or new.shop_id is distinct from old.shop_id
       or new.items_json is distinct from old.items_json
       or new.amount is distinct from old.amount
       or new.order_status is distinct from old.order_status
       or new.payment_status is distinct from old.payment_status
       or new.payment_method is distinct from old.payment_method
       or new.assigned_rider_id is distinct from old.assigned_rider_id
       or new.delivery_address is distinct from old.delivery_address
       or new.delivery_status is distinct from old.delivery_status
       or new.delivery_photo_url is distinct from old.delivery_photo_url
    then
      raise exception 'customers may only attach a payment_slip_url to their own order';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update this order';
end;
$function$;
