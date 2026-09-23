-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/migrations/20260923120500_head_office_rbac_delivery_guard_hardening.sql
-- Canonical blob SHA: 17af8f26dc0f0fe2580f20f3792770d3d41b0b3d

-- Final production verification hardening:
-- 1) preserve Delivery V3 non-admin RPC transitions that share mytree.admin_action,
--    while keeping Head Office bypass permission-scoped;
-- 2) remove the obsolete broad rider SELECT policy restored by the baseline migration;
-- 3) allow lifecycle cleanup of already-inactive Super Admin accounts without
--    weakening the last-active-Super-Admin invariant.

drop policy if exists shop_or_admin_reads_active_riders on public.riders;

create or replace function public.fn_guard_rider_delivery_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_shared_action boolean :=
    current_setting('mytree.admin_action', true) = 'true';
  v_is_staff boolean;
  v_is_rider boolean;
  v_is_customer boolean;
  v_my_rider_id uuid;
begin
  -- Preserve trusted service-role backend behavior.
  if current_user = 'service_role' then
    return new;
  end if;

  -- Head Office order actions remain permission-scoped.
  if v_shared_action
     and public.fn_admin_has_permission('orders.action') then
    return new;
  end if;

  select exists(
      select 1
      from public.shop_staff
      where shop_id = old.shop_id
        and customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
    or public.fn_admin_has_permission('orders.action')
  into v_is_staff;

  -- Shop staff are already an authorized order actor. Delivery V3 shop RPCs
  -- may use the shared admin_action GUC for trigger coordination.
  if v_is_staff then
    return new;
  end if;

  v_my_rider_id := public.fn_my_rider_id();

  -- Trusted Delivery V3 rider RPC transitions use the shared admin_action GUC.
  -- Do not grant a generic bypass: require the authenticated rider to be the
  -- old/new assignment and require one of the known forward/release transitions.
  if v_shared_action and v_my_rider_id is not null then
    if old.delivery_status = 'needs_rider'
       and old.assigned_rider_id is null
       and new.delivery_status = 'rider_called'
       and new.assigned_rider_id = v_my_rider_id
    then
      return new;
    end if;

    if old.delivery_status = 'rider_called'
       and old.assigned_rider_id = v_my_rider_id
       and new.delivery_status = 'picked_up'
       and new.assigned_rider_id = v_my_rider_id
    then
      return new;
    end if;

    if old.delivery_status = 'picked_up'
       and old.assigned_rider_id = v_my_rider_id
       and new.delivery_status = 'delivered'
       and new.assigned_rider_id = v_my_rider_id
    then
      return new;
    end if;

    if old.delivery_status = 'rider_called'
       and old.assigned_rider_id = v_my_rider_id
       and new.delivery_status = 'needs_rider'
       and new.assigned_rider_id is null
    then
      return new;
    end if;
  end if;

  v_is_rider := (
    old.assigned_rider_id is not null
    and old.assigned_rider_id = v_my_rider_id
  );

  -- Preserve the legacy direct rider update contract when admin_action is absent.
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
      if not (
        (old.delivery_status = 'rider_called' and new.delivery_status = 'picked_up')
        or (old.delivery_status = 'picked_up' and new.delivery_status = 'delivered')
      ) then
        raise exception 'invalid delivery status transition for rider';
      end if;

      if new.delivery_status = 'delivered'
         and new.delivery_photo_url is null then
        raise exception 'a delivery photo is required to mark as delivered';
      end if;
    end if;

    return new;
  end if;

  v_is_customer := (
    old.order_id in (select public.fn_my_hub_order_ids())
  );

  -- Trusted customer cancellation RPC: ownership remains mandatory and the
  -- transition must be the pre-pickup cancellation shape.
  if v_shared_action
     and v_is_customer
     and old.order_status <> 'cancelled'
     and new.order_status = 'cancelled'
     and new.delivery_status = 'failed'
     and new.assigned_rider_id is null
  then
    return new;
  end if;

  -- Preserve the legacy direct customer slip-only contract.
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
$fn$;

create or replace function public.fn_admin_set_role(
  p_customer_id uuid,
  p_role_key text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_before jsonb;
  v_after jsonb;
  v_current_role text;
  v_target_active boolean;
begin
  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required';
  end if;

  if not exists (
    select 1 from public.admin_roles ar where ar.role_key = p_role_key
  ) then
    raise exception 'unknown admin role';
  end if;

  if p_customer_id = private.current_admin_customer_id() then
    raise exception 'cannot change current admin role';
  end if;

  perform pg_advisory_xact_lock(743284, 1);

  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  select
    case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
    pa.is_active,
    jsonb_build_object(
      'customer_id', pa.customer_id,
      'role_key', case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
      'is_active', pa.is_active
    )
  into v_current_role, v_target_active, v_before
  from public.platform_admins pa
  where pa.customer_id = p_customer_id
  for update;

  if v_before is null then
    raise exception 'platform admin not found';
  end if;

  if v_target_active
     and v_current_role = 'super_admin'
     and p_role_key <> 'super_admin'
     and (
       select count(*)
       from public.platform_admins pa
       where pa.role::text = 'super_admin' and pa.is_active = true
     ) <= 1
  then
    raise exception 'cannot demote the last active super admin';
  end if;

  update public.platform_admins
  set role = p_role_key::public.admin_role_enum,
      updated_at = now()
  where customer_id = p_customer_id;

  select jsonb_build_object(
    'customer_id', pa.customer_id,
    'role_key', case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
    'is_active', pa.is_active
  )
  into v_after
  from public.platform_admins pa
  where pa.customer_id = p_customer_id;

  perform private.write_admin_audit(
    'system.admin.role_change',
    'platform_admin',
    p_customer_id::text,
    v_before,
    v_after,
    p_reason,
    jsonb_build_object('source', 'fn_admin_set_role')
  );

  return true;
end;
$fn$;

create or replace function public.fn_admin_set_active(
  p_customer_id uuid,
  p_is_active boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_before jsonb;
  v_after jsonb;
  v_role text;
  v_target_active boolean;
begin
  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required';
  end if;

  if p_customer_id = private.current_admin_customer_id()
     and p_is_active = false then
    raise exception 'cannot disable current admin account';
  end if;

  perform pg_advisory_xact_lock(743284, 1);

  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  select
    case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
    pa.is_active,
    jsonb_build_object(
      'customer_id', pa.customer_id,
      'role_key', case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
      'is_active', pa.is_active
    )
  into v_role, v_target_active, v_before
  from public.platform_admins pa
  where pa.customer_id = p_customer_id
  for update;

  if v_before is null then
    raise exception 'platform admin not found';
  end if;

  if p_is_active = false
     and v_target_active
     and v_role = 'super_admin'
     and (
       select count(*)
       from public.platform_admins pa
       where pa.role::text = 'super_admin' and pa.is_active = true
     ) <= 1
  then
    raise exception 'cannot disable the last active super admin';
  end if;

  update public.platform_admins
  set is_active = p_is_active,
      disabled_at = case when p_is_active then null else now() end,
      disabled_reason = case when p_is_active then null else p_reason end,
      updated_at = now()
  where customer_id = p_customer_id;

  select jsonb_build_object(
    'customer_id', pa.customer_id,
    'role_key', case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
    'is_active', pa.is_active
  )
  into v_after
  from public.platform_admins pa
  where pa.customer_id = p_customer_id;

  perform private.write_admin_audit(
    case when p_is_active then 'system.admin.enable' else 'system.admin.disable' end,
    'platform_admin',
    p_customer_id::text,
    v_before,
    v_after,
    p_reason,
    jsonb_build_object('source', 'fn_admin_set_active')
  );

  return true;
end;
$fn$;

revoke all on function public.fn_admin_set_role(uuid,text,text) from public, anon;
grant execute on function public.fn_admin_set_role(uuid,text,text) to authenticated, service_role;

revoke all on function public.fn_admin_set_active(uuid,boolean,text) from public, anon;
grant execute on function public.fn_admin_set_active(uuid,boolean,text) to authenticated, service_role;
