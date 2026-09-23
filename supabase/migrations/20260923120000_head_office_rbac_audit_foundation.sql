-- MyTree Head Office RBAC + Audit foundation
-- Compatibility-first migration:
--   * reuses public.platform_admins as canonical admin identity
--   * preserves existing admins by assigning super_admin
--   * keeps legacy fn_is_platform_admin() safe by restricting it to active super_admins
--   * introduces permission-aware helpers for new Head Office work
--   * adds append-oriented audit logging without relying on frontend hiding

begin;

create schema if not exists private;

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
  ('community_admin', 'Community Admin', 'Community/member operations'),
  ('moderation_admin', 'Moderation Admin', 'Safety and moderation actions'),
  ('shop_admin', 'Shop Admin', 'Shop lifecycle and merchant operations'),
  ('rider_admin', 'Rider Admin', 'Rider lifecycle and delivery operations'),
  ('finance_admin', 'Finance Admin', 'Finance and settlement operations'),
  ('support_admin', 'Support Admin', 'Customer support actions'),
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
select d.domain || '.' || a.action, d.domain, a.action,
       initcap(replace(d.domain, '_', ' ')) || ' ' || a.action
from domains d
cross join actions a
on conflict (permission_key) do nothing;

-- Explicit permission needed to read the append-only audit stream.
insert into public.admin_permissions(permission_key, domain, action, description)
values ('system.audit.read', 'system', 'audit.read', 'Read administrator audit history')
on conflict (permission_key) do nothing;

-- Super Admin gets every permission by construction.
insert into public.admin_role_permissions(role_key, permission_key)
select 'super_admin', permission_key
from public.admin_permissions
on conflict do nothing;

-- Conservative defaults for scoped roles. These can be extended without schema changes.
insert into public.admin_role_permissions(role_key, permission_key)
values
  ('operations_admin','communities.read'), ('operations_admin','members.read'),
  ('operations_admin','shops.read'), ('operations_admin','shops.update'), ('operations_admin','shops.action'),
  ('operations_admin','riders.read'), ('operations_admin','riders.update'), ('operations_admin','riders.action'),
  ('operations_admin','orders.read'), ('operations_admin','orders.update'), ('operations_admin','orders.action'),
  ('operations_admin','map.read'), ('operations_admin','map.update'),
  ('operations_admin','support.read'), ('operations_admin','support.update'), ('operations_admin','support.action'),
  ('operations_admin','analytics.read'), ('operations_admin','ai_operations.read'),

  ('community_admin','communities.read'), ('community_admin','communities.create'),
  ('community_admin','communities.update'), ('community_admin','communities.action'),
  ('community_admin','members.read'), ('community_admin','members.update'),
  ('community_admin','marketplace.read'), ('community_admin','map.read'),

  ('moderation_admin','communities.read'), ('moderation_admin','members.read'),
  ('moderation_admin','shops.read'), ('moderation_admin','riders.read'),
  ('moderation_admin','moderation.read'), ('moderation_admin','moderation.update'),
  ('moderation_admin','moderation.action'), ('moderation_admin','marketplace.read'),
  ('moderation_admin','marketplace.update'), ('moderation_admin','marketplace.action'),

  ('shop_admin','shops.read'), ('shop_admin','shops.update'), ('shop_admin','shops.action'),
  ('shop_admin','orders.read'), ('shop_admin','promotions.read'), ('shop_admin','pos.read'),
  ('shop_admin','map.read'),

  ('rider_admin','riders.read'), ('rider_admin','riders.update'), ('rider_admin','riders.action'),
  ('rider_admin','orders.read'), ('rider_admin','map.read'),

  ('finance_admin','finance.read'), ('finance_admin','finance.update'), ('finance_admin','finance.action'),
  ('finance_admin','orders.read'), ('finance_admin','analytics.read'),

  ('support_admin','support.read'), ('support_admin','support.update'), ('support_admin','support.action'),
  ('support_admin','members.read'), ('support_admin','shops.read'), ('support_admin','riders.read'),
  ('support_admin','orders.read'),

  ('marketing_admin','promotions.read'), ('marketing_admin','promotions.create'),
  ('marketing_admin','promotions.update'), ('marketing_admin','promotions.action'),
  ('marketing_admin','ads.read'), ('marketing_admin','ads.create'),
  ('marketing_admin','ads.update'), ('marketing_admin','ads.action'),
  ('marketing_admin','analytics.read'),

  ('read_only_analyst','communities.read'), ('read_only_analyst','members.read'),
  ('read_only_analyst','shops.read'), ('read_only_analyst','riders.read'),
  ('read_only_analyst','orders.read'), ('read_only_analyst','map.read'),
  ('read_only_analyst','moderation.read'), ('read_only_analyst','marketplace.read'),
  ('read_only_analyst','promotions.read'), ('read_only_analyst','ads.read'),
  ('read_only_analyst','pos.read'), ('read_only_analyst','support.read'),
  ('read_only_analyst','analytics.read'), ('read_only_analyst','finance.read'),
  ('read_only_analyst','ai_operations.read')
on conflict do nothing;

-- platform_admins already exists in production and remains the canonical identity table.
alter table public.platform_admins
  add column if not exists role_key text,
  add column if not exists is_active boolean not null default true,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists updated_at timestamptz not null default now();

update public.platform_admins
set role_key = 'super_admin'
where role_key is null;

alter table public.platform_admins
  alter column role_key set default 'super_admin',
  alter column role_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_admins_role_key_fkey'
      and conrelid = 'public.platform_admins'::regclass
  ) then
    alter table public.platform_admins
      add constraint platform_admins_role_key_fkey
      foreign key (role_key) references public.admin_roles(role_key);
  end if;
end $$;

create index if not exists idx_platform_admins_active_role
  on public.platform_admins (is_active, role_key);

create index if not exists idx_admin_role_permissions_permission
  on public.admin_role_permissions (permission_key, role_key);

-- Canonical actor identity is the custom MyTree JWT customer_id claim.
create or replace function private.current_admin_customer_id()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'customer_id', '');
$$;

revoke all on function private.current_admin_customer_id() from public;
revoke all on function private.current_admin_customer_id() from anon;
grant execute on function private.current_admin_customer_id() to authenticated;

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
    left join public.admin_role_permissions rp on rp.role_key = pa.role_key
    where pa.customer_id::text = private.current_admin_customer_id()
      and pa.is_active = true
      and (
        pa.role_key = 'super_admin'
        or rp.permission_key = p_permission_key
      )
  );
$$;

revoke all on function public.fn_admin_has_permission(text) from public;
revoke all on function public.fn_admin_has_permission(text) from anon;
grant execute on function public.fn_admin_has_permission(text) to authenticated;

-- Legacy compatibility guard: broad legacy admin RPCs remain usable by existing admins
-- because existing rows are migrated to super_admin. Scoped roles cannot inherit broad access.
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
    where pa.customer_id::text = private.current_admin_customer_id()
      and pa.is_active = true
      and pa.role_key = 'super_admin'
  );
$$;

revoke all on function public.fn_is_platform_admin() from public;
revoke all on function public.fn_is_platform_admin() from anon;
grant execute on function public.fn_is_platform_admin() to authenticated;

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
        'role_key', pa.role_key,
        'permissions',
          case
            when pa.role_key = 'super_admin' then
              (select jsonb_agg(ap.permission_key order by ap.permission_key) from public.admin_permissions ap)
            else
              coalesce(
                (
                  select jsonb_agg(rp.permission_key order by rp.permission_key)
                  from public.admin_role_permissions rp
                  where rp.role_key = pa.role_key
                ),
                '[]'::jsonb
              )
          end
      )
      from public.platform_admins pa
      where pa.customer_id::text = private.current_admin_customer_id()
      limit 1
    ),
    jsonb_build_object('customer_id', private.current_admin_customer_id(), 'is_active', false, 'role_key', null, 'permissions', '[]'::jsonb)
  );
$$;

revoke all on function public.fn_admin_access_context() from public;
revoke all on function public.fn_admin_access_context() from anon;
grant execute on function public.fn_admin_access_context() to authenticated;

create table if not exists public.admin_audit_log (
  audit_id bigint generated always as identity primary key,
  actor_customer_id text not null,
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

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.platform_admins enable row level security;

revoke all on public.admin_roles from public, anon, authenticated;
revoke all on public.admin_permissions from public, anon, authenticated;
revoke all on public.admin_role_permissions from public, anon, authenticated;
revoke all on public.admin_audit_log from public, anon, authenticated;
revoke all on public.platform_admins from public, anon, authenticated;

grant select on public.admin_roles to authenticated;
grant select on public.admin_permissions to authenticated;
grant select on public.admin_role_permissions to authenticated;
grant select on public.admin_audit_log to authenticated;
grant select on public.platform_admins to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='platform_admins' and policyname='platform_admin_self_read') then
    create policy platform_admin_self_read
      on public.platform_admins
      for select
      to authenticated
      using (customer_id::text = private.current_admin_customer_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_roles' and policyname='active_admin_read_roles') then
    create policy active_admin_read_roles
      on public.admin_roles
      for select
      to authenticated
      using (public.fn_admin_has_permission('system.read') or public.fn_is_platform_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_permissions' and policyname='active_admin_read_permissions') then
    create policy active_admin_read_permissions
      on public.admin_permissions
      for select
      to authenticated
      using (public.fn_admin_has_permission('system.read') or public.fn_is_platform_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_role_permissions' and policyname='active_admin_read_role_permissions') then
    create policy active_admin_read_role_permissions
      on public.admin_role_permissions
      for select
      to authenticated
      using (public.fn_admin_has_permission('system.read') or public.fn_is_platform_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_audit_log' and policyname='admin_audit_read') then
    create policy admin_audit_read
      on public.admin_audit_log
      for select
      to authenticated
      using (public.fn_admin_has_permission('system.audit.read'));
  end if;
end $$;

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
  v_actor text;
  v_role text;
begin
  v_actor := private.current_admin_customer_id();

  select pa.role_key
    into v_role
  from public.platform_admins pa
  where pa.customer_id::text = v_actor
    and pa.is_active = true
  limit 1;

  if v_actor is null or v_role is null then
    raise exception 'not authorized';
  end if;

  insert into public.admin_audit_log(
    actor_customer_id, actor_role_key, action, target_type, target_id,
    before_state, after_state, reason, metadata
  )
  values (
    v_actor, v_role, p_action, p_target_type, p_target_id,
    p_before_state, p_after_state, p_reason,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('txid', txid_current())
  );
end;
$$;

revoke all on function private.write_admin_audit(text,text,text,jsonb,jsonb,text,jsonb) from public;
revoke all on function private.write_admin_audit(text,text,text,jsonb,jsonb,text,jsonb) from anon;
revoke all on function private.write_admin_audit(text,text,text,jsonb,jsonb,text,jsonb) from authenticated;

-- Privileged role/status management. No direct client mutation of platform_admins.
create or replace function public.fn_admin_set_role(
  p_customer_id text,
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
begin
  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  if not exists (select 1 from public.admin_roles where role_key = p_role_key) then
    raise exception 'unknown admin role';
  end if;

  if p_customer_id = private.current_admin_customer_id() then
    raise exception 'cannot change current admin role';
  end if;

  if exists (
    select 1
    from public.platform_admins pa
    where pa.customer_id::text = p_customer_id
      and pa.role_key = 'super_admin'
      and pa.is_active = true
  ) and p_role_key <> 'super_admin'
    and (select count(*) from public.platform_admins where role_key = 'super_admin' and is_active = true) <= 1
  then
    raise exception 'cannot demote the last active super admin';
  end if;

  select to_jsonb(pa.*) into v_before
  from public.platform_admins pa
  where pa.customer_id::text = p_customer_id
  for update;

  if v_before is null then
    raise exception 'platform admin not found';
  end if;

  update public.platform_admins
  set role_key = p_role_key,
      updated_at = now()
  where customer_id::text = p_customer_id;

  select to_jsonb(pa.*) into v_after
  from public.platform_admins pa
  where pa.customer_id::text = p_customer_id;

  perform private.write_admin_audit(
    'system.admin.role_change', 'platform_admin', p_customer_id,
    v_before, v_after, nullif(p_reason,''), '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function public.fn_admin_set_active(
  p_customer_id text,
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
begin
  if not public.fn_admin_has_permission('system.admin') then
    raise exception 'permission denied: system.admin';
  end if;

  if p_customer_id = private.current_admin_customer_id() and p_is_active = false then
    raise exception 'cannot disable current admin account';
  end if;

  if p_is_active = false
    and exists (
      select 1
      from public.platform_admins pa
      where pa.customer_id::text = p_customer_id
        and pa.role_key = 'super_admin'
        and pa.is_active = true
    )
    and (select count(*) from public.platform_admins where role_key = 'super_admin' and is_active = true) <= 1
  then
    raise exception 'cannot disable the last active super admin';
  end if;

  select to_jsonb(pa.*) into v_before
  from public.platform_admins pa
  where pa.customer_id::text = p_customer_id
  for update;

  if v_before is null then
    raise exception 'platform admin not found';
  end if;

  update public.platform_admins
  set is_active = p_is_active,
      disabled_at = case when p_is_active then null else now() end,
      disabled_reason = case when p_is_active then null else nullif(p_reason,'') end,
      updated_at = now()
  where customer_id::text = p_customer_id;

  select to_jsonb(pa.*) into v_after
  from public.platform_admins pa
  where pa.customer_id::text = p_customer_id;

  perform private.write_admin_audit(
    case when p_is_active then 'system.admin.enable' else 'system.admin.disable' end,
    'platform_admin', p_customer_id, v_before, v_after, nullif(p_reason,''), '{}'::jsonb
  );

  return true;
end;
$$;

revoke all on function public.fn_admin_set_role(text,text,text) from public;
revoke all on function public.fn_admin_set_role(text,text,text) from anon;
grant execute on function public.fn_admin_set_role(text,text,text) to authenticated;

revoke all on function public.fn_admin_set_active(text,boolean,text) from public;
revoke all on function public.fn_admin_set_active(text,boolean,text) from anon;
grant execute on function public.fn_admin_set_active(text,boolean,text) to authenticated;

-- Audit existing governance mutations without replacing their signatures.
create or replace function private.audit_admin_target_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_role text;
  v_before jsonb;
  v_after jsonb;
  v_target_id text;
  v_action text;
  v_reason text;
begin
  -- Keep the audit payload intentionally narrow. Admin audit should capture
  -- governance state transitions without duplicating customer/shop PII.
  v_before := jsonb_strip_nulls(jsonb_build_object(
    'is_approved', to_jsonb(old) -> 'is_approved',
    'is_banned', to_jsonb(old) -> 'is_banned',
    'banned_reason', to_jsonb(old) -> 'banned_reason',
    'verified_at', to_jsonb(old) -> 'verified_at',
    'deletion_requested_at', to_jsonb(old) -> 'deletion_requested_at',
    'deletion_reason', to_jsonb(old) -> 'deletion_reason'
  ));
  v_after := jsonb_strip_nulls(jsonb_build_object(
    'is_approved', to_jsonb(new) -> 'is_approved',
    'is_banned', to_jsonb(new) -> 'is_banned',
    'banned_reason', to_jsonb(new) -> 'banned_reason',
    'verified_at', to_jsonb(new) -> 'verified_at',
    'deletion_requested_at', to_jsonb(new) -> 'deletion_requested_at',
    'deletion_reason', to_jsonb(new) -> 'deletion_reason'
  ));

  v_actor := private.current_admin_customer_id();

  select pa.role_key into v_role
  from public.platform_admins pa
  where pa.customer_id::text = v_actor
    and pa.is_active = true
  limit 1;

  if v_role is null then
    return new;
  end if;

  v_target_id := coalesce(v_after ->> tg_argv[1], v_before ->> tg_argv[1]);
  v_action := tg_argv[0] || '.update';

  if (v_before ->> 'is_approved') is distinct from (v_after ->> 'is_approved')
     and (v_after ->> 'is_approved') = 'true' then
    v_action := tg_argv[0] || '.approve';
  elsif (v_before ->> 'is_banned') is distinct from (v_after ->> 'is_banned')
     and (v_after ->> 'is_banned') = 'true' then
    v_action := tg_argv[0] || '.ban';
  elsif (v_before ->> 'is_banned') is distinct from (v_after ->> 'is_banned')
     and (v_after ->> 'is_banned') = 'false' then
    v_action := tg_argv[0] || '.unban';
  elsif (v_before ->> 'verified_at') is distinct from (v_after ->> 'verified_at')
     and (v_after ->> 'verified_at') is not null then
    v_action := tg_argv[0] || '.verify';
  end if;

  v_reason := coalesce(
    nullif(v_after ->> 'banned_reason', ''),
    nullif(v_after ->> 'deletion_reason', '')
  );

  perform private.write_admin_audit(
    v_action, tg_argv[0], v_target_id, v_before, v_after, v_reason,
    jsonb_build_object('source', 'db_trigger')
  );

  return new;
end;
$$;

revoke all on function private.audit_admin_target_mutation() from public;
revoke all on function private.audit_admin_target_mutation() from anon;
revoke all on function private.audit_admin_target_mutation() from authenticated;

do $$
begin
  if to_regclass('public.shops') is not null then
    drop trigger if exists trg_admin_audit_shops on public.shops;
    create trigger trg_admin_audit_shops
      after update on public.shops
      for each row execute function private.audit_admin_target_mutation('shops','shop_id');
  end if;

  if to_regclass('public.riders') is not null then
    drop trigger if exists trg_admin_audit_riders on public.riders;
    create trigger trg_admin_audit_riders
      after update on public.riders
      for each row execute function private.audit_admin_target_mutation('riders','id');
  end if;

  if to_regclass('public.customers') is not null then
    drop trigger if exists trg_admin_audit_customers on public.customers;
    create trigger trg_admin_audit_customers
      after update on public.customers
      for each row execute function private.audit_admin_target_mutation('customers','id');
  end if;
end $$;

comment on table public.admin_audit_log is
  'Append-oriented Head Office audit history. Client roles receive SELECT only through RLS; inserts come from trusted DB functions/triggers.';

comment on function public.fn_is_platform_admin() is
  'Legacy compatibility guard. Returns true only for active super_admin so scoped roles cannot inherit broad legacy admin RPC access.';

comment on function public.fn_admin_has_permission(text) is
  'Server-side RBAC permission check bound to the MyTree JWT customer_id claim.';

commit;
