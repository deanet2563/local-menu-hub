-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/migrations/20260923120400_head_office_rbac_lifecycle_race_hardening.sql
-- Canonical blob SHA: 5da9a107350ec5ee73703bee107306efb67d680a

-- Final RBAC lifecycle hardening discovered during production verification.
-- 1) Remove a legacy one-argument fn_revoke_rider overload if present so calls
--    with only rider_id resolve unambiguously to the canonical defaulted RPC.
-- 2) Re-check system.admin after the shared lifecycle advisory lock, ensuring an
--    administrator demoted/disabled while waiting cannot act with stale authority.

drop function if exists public.fn_revoke_rider(uuid);

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

  -- Authority must be current after waiting for the lifecycle serialization lock.
  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  select
    case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
    jsonb_build_object(
      'customer_id', pa.customer_id,
      'role_key', case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
      'is_active', pa.is_active
    )
  into v_current_role, v_before
  from public.platform_admins pa
  where pa.customer_id = p_customer_id
  for update;

  if v_before is null then
    raise exception 'platform admin not found';
  end if;

  if v_current_role = 'super_admin'
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
begin
  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required';
  end if;

  if p_customer_id = private.current_admin_customer_id() and p_is_active = false then
    raise exception 'cannot disable current admin account';
  end if;

  perform pg_advisory_xact_lock(743284, 1);

  -- Authority must be current after waiting for the lifecycle serialization lock.
  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  select
    case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
    jsonb_build_object(
      'customer_id', pa.customer_id,
      'role_key', case pa.role::text when 'support' then 'support_admin' else pa.role::text end,
      'is_active', pa.is_active
    )
  into v_role, v_before
  from public.platform_admins pa
  where pa.customer_id = p_customer_id
  for update;

  if v_before is null then
    raise exception 'platform admin not found';
  end if;

  if p_is_active = false
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
