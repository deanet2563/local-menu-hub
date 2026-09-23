-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/migrations/20260923120000_head_office_rbac_audit_foundation.sql
-- Canonical blob SHA: 8f4ac90155c9a04e61e3bee4c1f29f617406d16e

-- MyTree Head Office RBAC, permission enforcement, and append-oriented audit foundation.
-- Canonical migration owner: deanet2563/mytree-worker.
--
-- Compatibility decisions:
--   * public.platform_admins remains the canonical admin identity table.
--   * existing admin_role_enum + platform_admins.role are reused.
--   * legacy role "support" is treated as canonical "support_admin" by RBAC helpers.
--   * legacy admin RPC signatures are not changed.
--   * existing approve/ban/unban/revoke functions remain callable, while a DB trigger
--     now enforces the domain permission on governance-field mutations.
--   * fn_is_platform_admin() remains a coarse "active admin" identity helper only;
--     authorization must use fn_admin_has_permission().
--
-- Safe rollout order:
--   1) apply this migration;
--   2) verify RPC/RLS checks;
--   3) deploy local-menu-hub Head Office client changes.

-- ---------------------------------------------------------------------------
-- 1. Extend the existing admin role enum centrally.
-- ---------------------------------------------------------------------------

alter type public.admin_role_enum add value if not exists 'operations_admin';
alter type public.admin_role_enum add value if not exists 'community_admin';
alter type public.admin_role_enum add value if not exists 'moderation_admin';
alter type public.admin_role_enum add value if not exists 'shop_admin';
alter type public.admin_role_enum add value if not exists 'rider_admin';
alter type public.admin_role_enum add value if not exists 'finance_admin';
alter type public.admin_role_enum add value if not exists 'support_admin';
alter type public.admin_role_enum add value if not exists 'marketing_admin';
alter type public.admin_role_enum add value if not exists 'read_only_analyst';

create schema if not exists private;

-- Do not allow client roles to create shadow objects in public that could be
-- resolved by older SECURITY DEFINER functions using public in search_path.
revoke create on schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Role/permission catalog. Role metadata is data-driven; application code
--    should not scatter hard-coded authorization matrices.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_roles (
  role_key text primary key,
  display_name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_permissions (
  permission_key text primary key,
  domain text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (domain, action)
);

create table if not exists public.admin_role_permissions (
  role_key text not null references public.admin_roles(role_key) on delete cascade,
  permission_key text not null references public.admin_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

insert into public.admin_roles (role_key, display_name, description)
values
  ('super_admin', 'Super Admin', 'Full platform administration'),
  ('operations_admin', 'Operations Admin', 'Cross-functional day-to-day operations'),
  ('community_admin', 'Community Admin', 'Community and member operations'),
  ('moderation_admin', 'Moderation Admin', 'Safety, reports, bans, and moderation'),
  ('shop_admin', 'Shop Admin', 'Shop lifecycle and merchant operations'),
  ('rider_admin', 'Rider Admin', 'Rider lifecycle and delivery operations'),
  ('finance_admin', 'Finance Admin', 'Finance and settlement operations'),
  ('support_admin', 'Support Admin', 'Customer support operations'),
  ('marketing_admin', 'Marketing Admin', 'Promotions, ads, and growth operations'),
  ('read_only_analyst', 'Read-only Analyst', 'Read-only reporting and analytics')
on conflict (role_key) do update
set display_name = excluded.display_name,
    description = excluded.description;

with domains(domain) as (
  values
    ('communities'), ('members'), ('shops'), ('riders'), ('orders'), ('map'),
    ('moderation'), ('marketplace'), ('promotions'), ('ads'), ('pos'), ('support'),
    ('analytics'), ('system'), ('finance'), ('ai_operations')
),
actions(action) as (
  values ('read'), ('create'), ('update'), ('action'), ('admin')
)
insert into public.admin_permissions (permission_key, domain, action, description)
select
  d.domain || '.' || a.action,
  d.domain,
  a.action,
  initcap(replace(d.domain, '_', ' ')) || ' ' || a.action
from domains d
cross join actions a
on conflict (permission_key) do nothing;

insert into public.admin_permissions(permission_key, domain, action, description)
values ('system.audit.read', 'system', 'audit.read', 'Read administrator audit history')
on conflict (permission_key) do nothing;

-- Super Admin: every permission.
insert into public.admin_role_permissions(role_key, permission_key)
select 'super_admin', permission_key
from public.admin_permissions
on conflict do nothing;

-- Scoped roles. Additive changes can be made here later without changing app guards.
insert into public.admin_role_permissions(role_key, permission_key)
values
  ('operations_admin','communities.read'),
  ('operations_admin','members.read'),
  ('operations_admin','shops.read'),
  ('operations_admin','shops.update'),
  ('operations_admin','shops.action'),
  ('operations_admin','riders.read'),
  ('operations_admin','riders.update'),
  ('operations_admin','riders.action'),
  ('operations_admin','orders.read'),
  ('operations_admin','orders.update'),
  ('operations_admin','orders.action'),
  ('operations_admin','map.read'),
  ('operations_admin','map.update'),
  ('operations_admin','support.read'),
  ('operations_admin','support.update'),
  ('operations_admin','support.action'),
  ('operations_admin','analytics.read'),
  ('operations_admin','ai_operations.read'),

  ('community_admin','communities.read'),
  ('community_admin','communities.create'),
  ('community_admin','communities.update'),
  ('community_admin','communities.action'),
  ('community_admin','members.read'),
  ('community_admin','members.update'),
  ('community_admin','marketplace.read'),
  ('community_admin','map.read'),

  ('moderation_admin','communities.read'),
  ('moderation_admin','members.read'),
  ('moderation_admin','shops.read'),
  ('moderation_admin','riders.read'),
  ('moderation_admin','moderation.read'),
  ('moderation_admin','moderation.update'),
  ('moderation_admin','moderation.action'),
  ('moderation_admin','marketplace.read'),
  ('moderation_admin','marketplace.update'),
  ('moderation_admin','marketplace.action'),

  ('shop_admin','shops.read'),
  ('shop_admin','shops.update'),
  ('shop_admin','shops.action'),
  ('shop_admin','orders.read'),
  ('shop_admin','promotions.read'),
  ('shop_admin','pos.read'),
  ('shop_admin','map.read'),

  ('rider_admin','riders.read'),
  ('rider_admin','riders.update'),
  ('rider_admin','riders.action'),
  ('rider_admin','orders.read'),
  ('rider_admin','map.read'),

  ('finance_admin','finance.read'),
  ('finance_admin','finance.update'),
  ('finance_admin','finance.action'),
  ('finance_admin','orders.read'),
  ('finance_admin','analytics.read'),

  ('support_admin','support.read'),
  ('support_admin','support.update'),
  ('support_admin','support.action'),
  ('support_admin','members.read'),
  ('support_admin','shops.read'),
  ('support_admin','riders.read'),
  ('support_admin','orders.read'),

  ('marketing_admin','promotions.read'),
  ('marketing_admin','promotions.create'),
  ('marketing_admin','promotions.update'),
  ('marketing_admin','promotions.action'),
  ('marketing_admin','ads.read'),
  ('marketing_admin','ads.create'),
  ('marketing_admin','ads.update'),
  ('marketing_admin','ads.action'),
  ('marketing_admin','analytics.read'),

  ('read_only_analyst','communities.read'),
  ('read_only_analyst','members.read'),
  ('read_only_analyst','shops.read'),
  ('read_only_analyst','riders.read'),
  ('read_only_analyst','orders.read'),
  ('read_only_analyst','map.read'),
  ('read_only_analyst','moderation.read'),
  ('read_only_analyst','marketplace.read'),
  ('read_only_analyst','promotions.read'),
  ('read_only_analyst','ads.read'),
  ('read_only_analyst','pos.read'),
  ('read_only_analyst','support.read'),
  ('read_only_analyst','analytics.read'),
  ('read_only_analyst','finance.read'),
  ('read_only_analyst','ai_operations.read')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Canonical admin identity lifecycle.
-- ---------------------------------------------------------------------------

alter table public.platform_admins
  add column if not exists is_active boolean not null default true,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_platform_admins_active_role
  on public.platform_admins (is_active, role);

-- Existing "support" rows are intentionally not rewritten in this migration.
-- The helper below maps legacy support -> support_admin. This avoids unsafe
-- same-transaction enum-value use and keeps rollout backward compatible.

create or replace function private.current_admin_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'customer_id', '')::uuid;
$$;

revoke all on function private.current_admin_customer_id() from public, anon, authenticated;

create or replace function private.current_admin_role_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select
    case pa.role::text
      when 'support' then 'support_admin'
      else pa.role::text
    end
  from public.platform_admins pa
  where pa.customer_id = private.current_admin_customer_id()
    and pa.is_active = true
  limit 1;
$$;

revoke all on function private.current_admin_role_key() from public, anon, authenticated;

create or replace function public.fn_admin_has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    left join public.admin_role_permissions rp
      on rp.role_key = case pa.role::text
        when 'support' then 'support_admin'
        else pa.role::text
      end
    where pa.customer_id = private.current_admin_customer_id()
      and pa.is_active = true
      and (
        pa.role::text = 'super_admin'
        or rp.permission_key = p_permission_key
      )
  );
$$;

revoke all on function public.fn_admin_has_permission(text) from public, anon;
grant execute on function public.fn_admin_has_permission(text) to authenticated, service_role;

-- Coarse identity helper retained for compatibility. It is NOT an authorization
-- decision for a domain action; use fn_admin_has_permission() for that.
create or replace function public.fn_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.customer_id = private.current_admin_customer_id()
      and pa.is_active = true
  );
$$;

revoke all on function public.fn_is_platform_admin() from public, anon;
grant execute on function public.fn_is_platform_admin() to authenticated, service_role;

create or replace function public.fn_admin_access_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'customer_id', pa.customer_id::text,
        'is_active', pa.is_active,
        'role_key',
          case pa.role::text
            when 'support' then 'support_admin'
            else pa.role::text
          end,
        'permissions',
          case
            when pa.role::text = 'super_admin' then
              coalesce(
                (select jsonb_agg(ap.permission_key order by ap.permission_key)
                 from public.admin_permissions ap),
                '[]'::jsonb
              )
            else
              coalesce(
                (
                  select jsonb_agg(rp.permission_key order by rp.permission_key)
                  from public.admin_role_permissions rp
                  where rp.role_key = case pa.role::text
                    when 'support' then 'support_admin'
                    else pa.role::text
                  end
                ),
                '[]'::jsonb
              )
          end
      )
      from public.platform_admins pa
      where pa.customer_id = private.current_admin_customer_id()
      limit 1
    ),
    jsonb_build_object(
      'customer_id', private.current_admin_customer_id()::text,
      'is_active', false,
      'role_key', null,
      'permissions', '[]'::jsonb
    )
  );
$$;

revoke all on function public.fn_admin_access_context() from public, anon;
grant execute on function public.fn_admin_access_context() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Remove broad direct DML access to the admin identity table.
--    Existing self-read RLS policy remains compatible with PlatformAdminGate.
-- ---------------------------------------------------------------------------

revoke all on table public.platform_admins from public, anon, authenticated;
grant select on table public.platform_admins to authenticated;
grant all on table public.platform_admins to service_role;

-- ---------------------------------------------------------------------------
-- 5. RBAC catalog RLS/grants.
-- ---------------------------------------------------------------------------

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;

revoke all on table public.admin_roles from public, anon, authenticated;
revoke all on table public.admin_permissions from public, anon, authenticated;
revoke all on table public.admin_role_permissions from public, anon, authenticated;

grant select on table public.admin_roles to authenticated;
grant select on table public.admin_permissions to authenticated;
grant select on table public.admin_role_permissions to authenticated;

grant all on table public.admin_roles to service_role;
grant all on table public.admin_permissions to service_role;
grant all on table public.admin_role_permissions to service_role;

drop policy if exists active_admin_read_roles on public.admin_roles;
create policy active_admin_read_roles
  on public.admin_roles
  for select
  to authenticated
  using (public.fn_admin_has_permission('system.read'));

drop policy if exists active_admin_read_permissions on public.admin_permissions;
create policy active_admin_read_permissions
  on public.admin_permissions
  for select
  to authenticated
  using (public.fn_admin_has_permission('system.read'));

drop policy if exists active_admin_read_role_permissions on public.admin_role_permissions;
create policy active_admin_read_role_permissions
  on public.admin_role_permissions
  for select
  to authenticated
  using (public.fn_admin_has_permission('system.read'));

-- ---------------------------------------------------------------------------
-- 6. Permission-aware reads on existing sensitive admin datasets.
--    Preserve every non-admin clause from the production baseline.
-- ---------------------------------------------------------------------------

drop policy if exists shop_or_admin_reads_active_riders on public.riders;
create policy shop_or_admin_reads_active_riders
  on public.riders
  for select
  using (
    (is_online and is_approved)
    or customer_id = (auth.jwt() ->> 'customer_id')::uuid
    or public.fn_admin_has_permission('riders.read')
    or exists (
      select 1
      from public.sub_orders s
      where s.assigned_rider_id = riders.id
        and s.order_id in (select public.fn_my_hub_order_ids())
    )
  );

drop policy if exists read_own_or_related_customers on public.customers;
create policy read_own_or_related_customers
  on public.customers
  for select
  using (
    id = (auth.jwt() ->> 'customer_id')::uuid
    or public.fn_admin_has_permission('members.read')
    or public.fn_customer_related_to_caller(id)
  );


-- Replace every remaining baseline admin predicate that authorized solely by
-- platform_admins row existence. Disabled/scoped admins must not retain broad
-- PostgREST access after RBAC rollout.

drop policy if exists admin_only_subscription_payments on public.subscription_payments;
create policy admin_only_subscription_payments
  on public.subscription_payments
  using (public.fn_admin_has_permission('finance.action'))
  with check (public.fn_admin_has_permission('finance.action'));

drop policy if exists insert_hub_orders on public.hub_orders;
create policy insert_hub_orders
  on public.hub_orders
  for insert
  with check (
    customer_id is null
    or customer_id = (auth.jwt() ->> 'customer_id')::uuid
    or exists (select 1 from public.fn_staff_shop_ids())
    or public.fn_admin_has_permission('orders.create')
  );

drop policy if exists read_own_or_related_hub_orders on public.hub_orders;
create policy read_own_or_related_hub_orders
  on public.hub_orders
  for select
  using (
    customer_id = (auth.jwt() ->> 'customer_id')::uuid
    or exists (
      select 1
      from public.sub_orders so
      where so.order_id = hub_orders.order_id
        and so.shop_id in (select public.fn_staff_shop_ids())
    )
    or public.fn_admin_has_permission('orders.read')
  );

drop policy if exists shop_or_admin_inserts_order_items on public.order_items;
create policy shop_or_admin_inserts_order_items
  on public.order_items
  for insert
  with check (
    shop_id in (select public.fn_staff_shop_ids())
    or public.fn_admin_has_permission('orders.create')
  );

drop policy if exists shop_or_admin_reads_order_items on public.order_items;
create policy shop_or_admin_reads_order_items
  on public.order_items
  for select
  using (
    shop_id in (select public.fn_staff_shop_ids())
    or public.fn_admin_has_permission('orders.read')
  );

drop policy if exists shop_or_admin_reads_daily_summary on public.daily_shop_sales_summary;
create policy shop_or_admin_reads_daily_summary
  on public.daily_shop_sales_summary
  for select
  using (
    shop_id in (select public.fn_staff_shop_ids())
    or public.fn_admin_has_permission('analytics.read')
  );

drop policy if exists shop_owns_sub_orders on public.sub_orders;
create policy shop_owns_sub_orders
  on public.sub_orders
  using (
    shop_id in (select public.fn_staff_shop_ids())
    or public.fn_admin_has_permission('orders.action')
  )
  with check (
    shop_id in (select public.fn_staff_shop_ids())
    or public.fn_admin_has_permission('orders.action')
  );

-- ---------------------------------------------------------------------------
-- 7. Server-side permission enforcement for existing governance mutations.
--    Legacy RPCs keep their signatures/logic. This trigger blocks the update
--    unless the calling active admin has the domain permission.
-- ---------------------------------------------------------------------------

create or replace function private.enforce_admin_governance_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_admin_customer_id();
  v_is_admin boolean;
  v_permission text;
  v_before jsonb := to_jsonb(old);
  v_after jsonb := to_jsonb(new);
  v_governance_changed boolean := false;
begin
  if v_actor is null then
    return new;
  end if;

  select exists (
    select 1
    from public.platform_admins pa
    where pa.customer_id = v_actor
      and pa.is_active = true
  ) into v_is_admin;

  if not v_is_admin then
    return new;
  end if;

  if tg_table_name = 'shops' then
    v_permission := 'shops.action';
    v_governance_changed :=
      (v_before -> 'is_approved') is distinct from (v_after -> 'is_approved')
      or (v_before -> 'approved_at') is distinct from (v_after -> 'approved_at')
      or (v_before -> 'approved_by') is distinct from (v_after -> 'approved_by')
      or (v_before -> 'is_banned') is distinct from (v_after -> 'is_banned')
      or (v_before -> 'banned_reason') is distinct from (v_after -> 'banned_reason')
      or (v_before -> 'banned_at') is distinct from (v_after -> 'banned_at')
      or (v_before -> 'banned_by') is distinct from (v_after -> 'banned_by')
      or (v_before -> 'deletion_requested_at') is distinct from (v_after -> 'deletion_requested_at')
      or (v_before -> 'deletion_reason') is distinct from (v_after -> 'deletion_reason');
  elsif tg_table_name = 'riders' then
    v_permission := 'riders.action';
    v_governance_changed :=
      (v_before -> 'is_approved') is distinct from (v_after -> 'is_approved')
      or (v_before -> 'verified_at') is distinct from (v_after -> 'verified_at')
      or (v_before -> 'verified_by') is distinct from (v_after -> 'verified_by')
      or (v_before -> 'is_banned') is distinct from (v_after -> 'is_banned')
      or (v_before -> 'banned_reason') is distinct from (v_after -> 'banned_reason')
      or (v_before -> 'banned_at') is distinct from (v_after -> 'banned_at')
      or (v_before -> 'banned_by') is distinct from (v_after -> 'banned_by')
      or (v_before -> 'deletion_requested_at') is distinct from (v_after -> 'deletion_requested_at')
      or (v_before -> 'deletion_reason') is distinct from (v_after -> 'deletion_reason');
  elsif tg_table_name = 'customers' then
    v_permission := 'moderation.action';
    v_governance_changed :=
      (v_before -> 'is_banned') is distinct from (v_after -> 'is_banned')
      or (v_before -> 'banned_reason') is distinct from (v_after -> 'banned_reason')
      or (v_before -> 'banned_at') is distinct from (v_after -> 'banned_at')
      or (v_before -> 'banned_by') is distinct from (v_after -> 'banned_by');
  end if;

  if v_governance_changed and not public.fn_admin_has_permission(v_permission) then
    raise exception 'permission denied: %', v_permission;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_admin_governance_permission() from public, anon, authenticated;

drop trigger if exists a_head_office_rbac_guard on public.shops;
create trigger a_head_office_rbac_guard
  before update on public.shops
  for each row execute function private.enforce_admin_governance_permission();

drop trigger if exists a_head_office_rbac_guard on public.riders;
create trigger a_head_office_rbac_guard
  before update on public.riders
  for each row execute function private.enforce_admin_governance_permission();

drop trigger if exists a_head_office_rbac_guard on public.customers;
create trigger a_head_office_rbac_guard
  before update on public.customers
  for each row execute function private.enforce_admin_governance_permission();

-- ---------------------------------------------------------------------------
-- 8. Harden the order guard's direct platform-admin bypass. Existing
--    mytree.admin_action calls are admin-only and now require orders.action.
-- ---------------------------------------------------------------------------

create or replace function public.fn_guard_rider_delivery_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_is_staff boolean;
  v_is_rider boolean;
  v_is_customer boolean;
begin
  if current_setting('mytree.admin_action', true) = 'true' then
    if public.fn_admin_has_permission('orders.action') then
      return new;
    end if;
    raise exception 'permission denied: orders.action';
  end if;

  select exists(
      select 1
      from public.shop_staff
      where shop_id = old.shop_id
        and customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
    or public.fn_admin_has_permission('orders.action')
  into v_is_staff;

  if v_is_staff then
    return new;
  end if;

  v_is_rider := (
    old.assigned_rider_id is not null
    and old.assigned_rider_id = public.fn_my_rider_id()
  );

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

      if new.delivery_status = 'delivered' and new.delivery_photo_url is null then
        raise exception 'a delivery photo is required to mark as delivered';
      end if;
    end if;

    return new;
  end if;

  v_is_customer := (
    old.order_id in (select public.fn_my_hub_order_ids())
  );

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
$$;

-- ---------------------------------------------------------------------------
-- 9. Append-oriented audit log. No client insert/update/delete grants.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_log (
  audit_id bigint generated always as identity primary key,
  actor_customer_id uuid not null,
  actor_role_key text,
  action text not null,
  target_type text not null,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_actor
  on public.admin_audit_log (actor_customer_id, created_at desc);
create index if not exists idx_admin_audit_log_target
  on public.admin_audit_log (target_type, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;

revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select on table public.admin_audit_log to authenticated;
grant all on table public.admin_audit_log to service_role;

drop policy if exists admin_audit_read on public.admin_audit_log;
create policy admin_audit_read
  on public.admin_audit_log
  for select
  to authenticated
  using (public.fn_admin_has_permission('system.audit.read'));

create or replace function private.write_admin_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before_state jsonb,
  p_after_state jsonb,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_admin_customer_id();
  v_role text := private.current_admin_role_key();
begin
  if v_actor is null or v_role is null then
    raise exception 'not authorized: active platform admin required';
  end if;

  insert into public.admin_audit_log(
    actor_customer_id,
    actor_role_key,
    action,
    target_type,
    target_id,
    before_state,
    after_state,
    reason,
    metadata
  )
  values (
    v_actor,
    v_role,
    p_action,
    p_target_type,
    p_target_id,
    p_before_state,
    p_after_state,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('txid', txid_current())
  );
end;
$$;

revoke all on function private.write_admin_audit(text,text,text,jsonb,jsonb,text,jsonb)
  from public, anon, authenticated;

create or replace function private.audit_admin_governance_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_admin_customer_id();
  v_role text := private.current_admin_role_key();
  v_before_raw jsonb := to_jsonb(old);
  v_after_raw jsonb := to_jsonb(new);
  v_before jsonb;
  v_after jsonb;
  v_action text;
  v_target_id text;
  v_reason text;
  v_changed boolean := false;
begin
  if v_actor is null or v_role is null then
    return new;
  end if;

  if tg_table_name = 'shops' then
    v_target_id := v_after_raw ->> 'shop_id';
    v_changed :=
      (v_before_raw -> 'is_approved') is distinct from (v_after_raw -> 'is_approved')
      or (v_before_raw -> 'is_banned') is distinct from (v_after_raw -> 'is_banned')
      or (v_before_raw -> 'deletion_requested_at') is distinct from (v_after_raw -> 'deletion_requested_at')
      or (v_before_raw -> 'deletion_reason') is distinct from (v_after_raw -> 'deletion_reason');
  elsif tg_table_name = 'riders' then
    v_target_id := v_after_raw ->> 'id';
    v_changed :=
      (v_before_raw -> 'is_approved') is distinct from (v_after_raw -> 'is_approved')
      or (v_before_raw -> 'verified_at') is distinct from (v_after_raw -> 'verified_at')
      or (v_before_raw -> 'is_banned') is distinct from (v_after_raw -> 'is_banned')
      or (v_before_raw -> 'deletion_requested_at') is distinct from (v_after_raw -> 'deletion_requested_at')
      or (v_before_raw -> 'deletion_reason') is distinct from (v_after_raw -> 'deletion_reason');
  elsif tg_table_name = 'customers' then
    v_target_id := v_after_raw ->> 'id';
    v_changed :=
      (v_before_raw -> 'is_banned') is distinct from (v_after_raw -> 'is_banned');
  end if;

  if not v_changed then
    return new;
  end if;

  v_before := jsonb_strip_nulls(jsonb_build_object(
    'is_approved', v_before_raw -> 'is_approved',
    'is_banned', v_before_raw -> 'is_banned',
    'banned_reason', v_before_raw -> 'banned_reason',
    'verified_at', v_before_raw -> 'verified_at',
    'deletion_requested_at', v_before_raw -> 'deletion_requested_at',
    'deletion_reason', v_before_raw -> 'deletion_reason'
  ));

  v_after := jsonb_strip_nulls(jsonb_build_object(
    'is_approved', v_after_raw -> 'is_approved',
    'is_banned', v_after_raw -> 'is_banned',
    'banned_reason', v_after_raw -> 'banned_reason',
    'verified_at', v_after_raw -> 'verified_at',
    'deletion_requested_at', v_after_raw -> 'deletion_requested_at',
    'deletion_reason', v_after_raw -> 'deletion_reason'
  ));

  if (v_before_raw ->> 'verified_at') is distinct from (v_after_raw ->> 'verified_at')
     and (v_after_raw ->> 'verified_at') is not null then
    v_action := tg_table_name || '.verify';
  elsif (v_before_raw ->> 'is_approved') is distinct from (v_after_raw ->> 'is_approved')
     and (v_after_raw ->> 'is_approved') = 'true' then
    v_action := tg_table_name || '.approve';
  elsif (v_before_raw ->> 'is_approved') is distinct from (v_after_raw ->> 'is_approved')
     and (v_after_raw ->> 'is_approved') = 'false' then
    v_action := tg_table_name || '.revoke';
  elsif (v_before_raw ->> 'is_banned') is distinct from (v_after_raw ->> 'is_banned')
     and (v_after_raw ->> 'is_banned') = 'true' then
    v_action := tg_table_name || '.ban';
  elsif (v_before_raw ->> 'is_banned') is distinct from (v_after_raw ->> 'is_banned')
     and (v_after_raw ->> 'is_banned') = 'false' then
    v_action := tg_table_name || '.unban';
  elsif (v_before_raw ->> 'deletion_requested_at') is distinct from (v_after_raw ->> 'deletion_requested_at')
     and (v_after_raw ->> 'deletion_requested_at') is null then
    v_action := tg_table_name || '.deletion_reject';
  else
    v_action := tg_table_name || '.governance_update';
  end if;

  v_reason := coalesce(
    nullif(current_setting('mytree.admin_reason', true), ''),
    nullif(v_after_raw ->> 'banned_reason', ''),
    nullif(v_after_raw ->> 'deletion_reason', '')
  );

  perform private.write_admin_audit(
    v_action,
    tg_table_name,
    v_target_id,
    v_before,
    v_after,
    v_reason,
    jsonb_build_object('source', 'db_trigger')
  );

  return new;
end;
$$;

revoke all on function private.audit_admin_governance_update()
  from public, anon, authenticated;

drop trigger if exists z_head_office_admin_audit on public.shops;
create trigger z_head_office_admin_audit
  after update on public.shops
  for each row execute function private.audit_admin_governance_update();

drop trigger if exists z_head_office_admin_audit on public.riders;
create trigger z_head_office_admin_audit
  after update on public.riders
  for each row execute function private.audit_admin_governance_update();

drop trigger if exists z_head_office_admin_audit on public.customers;
create trigger z_head_office_admin_audit
  after update on public.customers
  for each row execute function private.audit_admin_governance_update();

-- Capture an optional revoke reason for the existing fn_revoke_rider path without
-- changing its public signature. Other legacy functions already persist their
-- ban/deletion reasons in target state.
create or replace function public.fn_revoke_rider(
  p_rider_id uuid,
  p_reason text default null
)
returns public.riders
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.riders;
begin
  if not public.fn_is_platform_admin() then
    raise exception 'not authorized: platform admin only';
  end if;

  perform set_config('mytree.admin_action', 'true', true);
  perform set_config('mytree.admin_reason', coalesce(p_reason, ''), true);

  update public.riders
  set is_approved = false,
      is_online = false,
      verified_at = null,
      verified_by = null,
      offers_passenger = false
  where id = p_rider_id
  returning * into v_row;

  if not found then
    raise exception 'rider % not found', p_rider_id;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Privileged admin lifecycle RPCs. No frontend/client direct writes.
-- ---------------------------------------------------------------------------

create or replace function public.fn_admin_set_role(
  p_customer_id uuid,
  p_role_key text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

  -- Serialize all role/status transitions that could affect the invariant
  -- "at least one active Super Admin remains".
  perform pg_advisory_xact_lock(743284, 1);

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
$$;

create or replace function public.fn_admin_set_active(
  p_customer_id uuid,
  p_is_active boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

  -- Same lock as fn_admin_set_role(), preventing concurrent demote/disable
  -- transactions from observing stale Super Admin counts.
  perform pg_advisory_xact_lock(743284, 1);

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
$$;

revoke all on function public.fn_admin_set_role(uuid,text,text) from public, anon;
grant execute on function public.fn_admin_set_role(uuid,text,text) to authenticated, service_role;

revoke all on function public.fn_admin_set_active(uuid,boolean,text) from public, anon;
grant execute on function public.fn_admin_set_active(uuid,boolean,text) to authenticated, service_role;

comment on function public.fn_is_platform_admin() is
  'Coarse active Platform Admin identity check only. Domain authorization must use fn_admin_has_permission().';

comment on function public.fn_admin_has_permission(text) is
  'Server-side Head Office RBAC authorization bound to the MyTree customer_id JWT claim.';

comment on table public.admin_audit_log is
  'Append-oriented Head Office audit history. Authenticated admins receive SELECT only through RLS; writes come from trusted DB triggers/RPCs.';

-- Bootstrap rule: this migration does not create a Super Admin from a client
-- request. Initial/recovery bootstrap must be performed through reviewed DB or
-- service-role operations, then all ongoing role/status changes use the RPCs.
