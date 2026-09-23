-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/tests/head_office_rbac_fixture.sql
-- Canonical blob SHA: 729a67472d92abceb6e4d5b9bb8ce5858f8a1b25

\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

grant usage on schema auth to authenticated, service_role;
grant execute on function auth.jwt() to authenticated, service_role;

create type public.admin_role_enum as enum ('super_admin', 'support');

create table public.customers (
  id uuid primary key,
  name text,
  is_banned boolean not null default false,
  banned_reason text,
  banned_at timestamptz,
  banned_by uuid
);

create table public.platform_admins (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  role public.admin_role_enum default 'support'::public.admin_role_enum,
  created_at timestamptz default now()
);

create table public.shops (
  shop_id text primary key,
  name text not null,
  category text,
  is_open boolean default false,
  is_approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  is_banned boolean not null default false,
  banned_reason text,
  banned_at timestamptz,
  banned_by uuid,
  deletion_requested_at timestamptz,
  deletion_reason text
);

create table public.riders (
  id uuid primary key,
  customer_id uuid references public.customers(id),
  name text not null,
  is_online boolean not null default false,
  is_approved boolean not null default false,
  rider_class text default 'general',
  plate_number text,
  win_registration_no text,
  verified_at timestamptz,
  verified_by uuid,
  offers_passenger boolean not null default false,
  is_banned boolean not null default false,
  banned_reason text,
  banned_at timestamptz,
  banned_by uuid,
  deletion_requested_at timestamptz,
  deletion_reason text
);

create table public.shop_staff (
  shop_id text not null,
  customer_id uuid not null
);

create table public.hub_orders (
  order_id uuid primary key,
  customer_id uuid
);

create table public.sub_orders (
  sub_id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  shop_id text not null,
  assigned_rider_id uuid
);

create table public.order_items (
  item_id uuid primary key default gen_random_uuid(),
  sub_id uuid,
  shop_id text not null
);

create table public.daily_shop_sales_summary (
  shop_id text not null,
  sales_date date not null default current_date
);

create table public.subscription_payments (
  payment_id uuid primary key default gen_random_uuid(),
  amount numeric not null default 0
);

create table public.shop_category_master (
  category_id uuid primary key default gen_random_uuid(),
  label text not null unique,
  icon text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.shop_category_master enable row level security;

create policy "active shop categories are public"
  on public.shop_category_master
  for select
  to anon, authenticated
  using (is_active = true);

create policy "platform admins can read all shop categories"
  on public.shop_category_master
  for select
  to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

create or replace function public.fn_admin_create_shop_category(
  p_label text,
  p_icon text default null,
  p_sort_order integer default 100
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.platform_admins pa
    where pa.customer_id = (auth.jwt() ->> 'customer_id')::uuid
  ) then
    raise exception 'forbidden';
  end if;
  insert into public.shop_category_master(label,icon,sort_order)
  values (p_label,p_icon,p_sort_order)
  returning category_id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.fn_admin_update_shop_category(
  p_category_id uuid,
  p_label text,
  p_icon text,
  p_sort_order integer,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if not exists (
    select 1 from public.platform_admins pa
    where pa.customer_id = (auth.jwt() ->> 'customer_id')::uuid
  ) then
    raise exception 'forbidden';
  end if;
  update public.shop_category_master
  set label=p_label, icon=p_icon, sort_order=p_sort_order, is_active=p_is_active
  where category_id=p_category_id;
end;
$fn$;

create or replace function public.fn_shop_request_delivery_v3(p_sub_id uuid)
returns table(result text, sub_id uuid, shop_id text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_actor_customer_id uuid := (auth.jwt() ->> 'customer_id')::uuid;
begin
  if not (
    exists(select 1 from public.shop_staff ss where ss.customer_id=v_actor_customer_id)
    or exists(
      select 1 from public.platform_admins pa
      where pa.customer_id = v_actor_customer_id
    )
  ) then
    raise exception 'shop_actor_not_authorized';
  end if;
  return query select 'ok'::text, p_sub_id, 'shop-test'::text;
end;
$fn$;

create or replace function public.fn_shop_reoffer_delivery_v3(
  p_sub_id uuid,
  p_reason_code text,
  p_note text default null
)
returns table(result text, sub_id uuid, previous_assigned_rider_id uuid, shop_id text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_actor_customer_id uuid := (auth.jwt() ->> 'customer_id')::uuid;
begin
  if not (
    exists(select 1 from public.shop_staff ss where ss.customer_id=v_actor_customer_id)
    or exists(
      select 1 from public.platform_admins pa
      where pa.customer_id = v_actor_customer_id
    )
  ) then
    raise exception 'shop_actor_not_authorized';
  end if;
  return query select 'ok'::text, p_sub_id, null::uuid, 'shop-test'::text;
end;
$fn$;

create or replace function public.fn_shop_cancel_delivery_v3(
  p_sub_id uuid,
  p_reason_code text,
  p_note text
)
returns table(result text, sub_id uuid, previous_assigned_rider_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_actor_customer_id uuid := (auth.jwt() ->> 'customer_id')::uuid;
begin
  if not (
    exists(select 1 from public.shop_staff ss where ss.customer_id=v_actor_customer_id)
    or exists(
      select 1 from public.platform_admins pa
      where pa.customer_id = v_actor_customer_id
    )
  ) then
    raise exception 'shop_actor_not_authorized';
  end if;
  return query select 'ok'::text, p_sub_id, null::uuid;
end;
$fn$;


create or replace function public.fn_staff_shop_ids()
returns setof text
language sql
stable
as $fn$
  select ss.shop_id
  from public.shop_staff ss
  where ss.customer_id = (auth.jwt() ->> 'customer_id')::uuid
$fn$;

create or replace function public.fn_my_hub_order_ids()
returns setof uuid
language sql
stable
as $fn$ select null::uuid where false $fn$;

create or replace function public.fn_customer_related_to_caller(p_customer_id uuid)
returns boolean
language sql
stable
as $$ select false $$;

create or replace function public.fn_my_rider_id()
returns uuid
language sql
stable
as $$ select null::uuid $$;

alter table public.platform_admins enable row level security;
alter table public.riders enable row level security;
alter table public.customers enable row level security;
alter table public.hub_orders enable row level security;
alter table public.sub_orders enable row level security;
alter table public.order_items enable row level security;
alter table public.daily_shop_sales_summary enable row level security;
alter table public.subscription_payments enable row level security;

create policy self_reads_own_admin_row
  on public.platform_admins
  for select
  using (customer_id = (auth.jwt() ->> 'customer_id')::uuid);

create policy rider_reads_scoped_rows
  on public.riders
  for select
  using (
    customer_id = (auth.jwt() ->> 'customer_id')::uuid
    or exists (
      select 1 from public.platform_admins pa
      where pa.customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
    or (
      is_online = true
      and is_approved = true
      and is_banned = false
      and exists (select 1 from public.fn_staff_shop_ids())
    )
    or exists (
      select 1 from public.sub_orders s
      where s.assigned_rider_id = riders.id
        and s.order_id in (select public.fn_my_hub_order_ids())
    )
  );

create policy shop_or_admin_reads_active_riders
  on public.riders
  for select
  using (
    (is_online and is_approved)
    or customer_id = (auth.jwt() ->> 'customer_id')::uuid
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
    or exists (
      select 1 from public.sub_orders s
      where s.assigned_rider_id = riders.id
        and s.order_id in (select public.fn_my_hub_order_ids())
    )
  );

create policy read_own_or_related_customers
  on public.customers
  for select
  using (
    id = (auth.jwt() ->> 'customer_id')::uuid
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
    or public.fn_customer_related_to_caller(id)
  );


create policy admin_only_subscription_payments
  on public.subscription_payments
  using (
    exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

create policy insert_hub_orders
  on public.hub_orders
  for insert
  with check (
    customer_id is null
    or customer_id = (auth.jwt() ->> 'customer_id')::uuid
    or exists (select 1 from public.fn_staff_shop_ids())
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

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
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

create policy customer_reads_own_sub_orders
  on public.sub_orders
  for select
  using (order_id in (select public.fn_my_hub_order_ids()));

create policy shop_owns_sub_orders
  on public.sub_orders
  using (
    shop_id in (select public.fn_staff_shop_ids())
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

create policy shop_or_admin_inserts_order_items
  on public.order_items
  for insert
  with check (
    shop_id in (select public.fn_staff_shop_ids())
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

create policy shop_or_admin_reads_order_items
  on public.order_items
  for select
  using (
    shop_id in (select public.fn_staff_shop_ids())
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

create policy shop_or_admin_reads_daily_summary
  on public.daily_shop_sales_summary
  for select
  using (
    shop_id in (select public.fn_staff_shop_ids())
    or exists (
      select 1 from public.platform_admins
      where customer_id = (auth.jwt() ->> 'customer_id')::uuid
    )
  );

grant all on table public.platform_admins to anon, authenticated, service_role;
grant select on table public.shops, public.riders, public.customers, public.shop_staff to authenticated;
grant all on table public.hub_orders, public.sub_orders, public.order_items, public.daily_shop_sales_summary, public.subscription_payments to authenticated;
grant select on table public.shop_category_master to anon, authenticated;
grant all on table public.hub_orders, public.sub_orders, public.order_items, public.daily_shop_sales_summary, public.subscription_payments, public.shop_category_master to service_role;
grant execute on function public.fn_admin_create_shop_category(text,text,integer) to authenticated, service_role;
grant execute on function public.fn_admin_update_shop_category(uuid,text,text,integer,boolean) to authenticated, service_role;
grant execute on function public.fn_shop_request_delivery_v3(uuid) to authenticated, service_role;
grant execute on function public.fn_shop_reoffer_delivery_v3(uuid,text,text) to authenticated, service_role;
grant execute on function public.fn_shop_cancel_delivery_v3(uuid,text,text) to authenticated, service_role;

create or replace function public.fn_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.platform_admins
    where customer_id = (auth.jwt() ->> 'customer_id')::uuid
  );
$$;

revoke all on function public.fn_is_platform_admin() from public;
grant execute on function public.fn_is_platform_admin() to authenticated, service_role;

create or replace function public.fn_approve_shop(p_shop_id text)
returns public.shops
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_admin uuid := (auth.jwt() ->> 'customer_id')::uuid;
  v_row public.shops;
begin
  if not public.fn_is_platform_admin() then
    raise exception 'not authorized: platform admin only';
  end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.shops
  set is_approved = true, approved_at = now(), approved_by = v_admin
  where shop_id = p_shop_id
  returning * into v_row;
  if not found then raise exception 'shop % not found', p_shop_id; end if;
  return v_row;
end;
$$;

create or replace function public.fn_ban_shop(p_shop_id text, p_reason text)
returns public.shops
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_admin uuid := (auth.jwt() ->> 'customer_id')::uuid;
  v_row public.shops;
begin
  if not public.fn_is_platform_admin() then raise exception 'not authorized: platform admin only'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required'; end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.shops
  set is_banned = true, banned_reason = p_reason, banned_at = now(), banned_by = v_admin, is_open = false
  where shop_id = p_shop_id
  returning * into v_row;
  if not found then raise exception 'shop % not found', p_shop_id; end if;
  return v_row;
end;
$$;

create or replace function public.fn_unban_shop(p_shop_id text)
returns public.shops
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_row public.shops;
begin
  if not public.fn_is_platform_admin() then raise exception 'not authorized: platform admin only'; end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.shops
  set is_banned = false, banned_reason = null, banned_at = null, banned_by = null
  where shop_id = p_shop_id
  returning * into v_row;
  if not found then raise exception 'shop % not found', p_shop_id; end if;
  return v_row;
end;
$$;

create or replace function public.fn_approve_rider(p_rider_id uuid)
returns public.riders
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_row public.riders;
begin
  if not public.fn_is_platform_admin() then raise exception 'not authorized: platform admin only'; end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.riders set is_approved = true where id = p_rider_id returning * into v_row;
  if not found then raise exception 'rider % not found', p_rider_id; end if;
  return v_row;
end;
$$;

create or replace function public.fn_ban_rider(p_rider_id uuid, p_reason text)
returns public.riders
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_admin uuid := (auth.jwt() ->> 'customer_id')::uuid;
  v_row public.riders;
begin
  if not public.fn_is_platform_admin() then raise exception 'not authorized: platform admin only'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required'; end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.riders
  set is_banned = true, banned_reason = p_reason, banned_at = now(), banned_by = v_admin,
      is_online = false, offers_passenger = false
  where id = p_rider_id
  returning * into v_row;
  if not found then raise exception 'rider % not found', p_rider_id; end if;
  return v_row;
end;
$$;

create or replace function public.fn_unban_rider(p_rider_id uuid)
returns public.riders
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare v_row public.riders;
begin
  if not public.fn_is_platform_admin() then raise exception 'not authorized: platform admin only'; end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.riders
  set is_banned = false, banned_reason = null, banned_at = null, banned_by = null
  where id = p_rider_id
  returning * into v_row;
  if not found then raise exception 'rider % not found', p_rider_id; end if;
  return v_row;
end;
$fn$;


create or replace function public.fn_verify_rider_document(p_rider_id uuid)
returns public.riders
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_admin uuid := (auth.jwt() ->> 'customer_id')::uuid;
  v_row public.riders;
begin
  if not public.fn_is_platform_admin() then
    raise exception 'not authorized: platform admin only';
  end if;

  select * into v_row from public.riders where id = p_rider_id;
  if not found then raise exception 'rider % not found', p_rider_id; end if;
  if v_row.rider_class <> 'public_win' then
    raise exception 'only public_win riders require document verification';
  end if;
  if v_row.plate_number is null or v_row.win_registration_no is null then
    raise exception 'cannot verify: documents incomplete';
  end if;

  perform set_config('mytree.admin_action', 'true', true);
  update public.riders
  set verified_at = now(),
      verified_by = v_admin,
      is_approved = true
  where id = p_rider_id
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.fn_ban_customer(p_customer_id uuid, p_reason text)
returns public.customers
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_admin uuid := (auth.jwt() ->> 'customer_id')::uuid;
  v_row public.customers;
begin
  if not public.fn_is_platform_admin() then raise exception 'not authorized: platform admin only'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required'; end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.customers
  set is_banned = true, banned_reason = p_reason, banned_at = now(), banned_by = v_admin
  where id = p_customer_id
  returning * into v_row;
  if not found then raise exception 'customer % not found', p_customer_id; end if;
  return v_row;
end;
$$;

create or replace function public.fn_unban_customer(p_customer_id uuid)
returns public.customers
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_row public.customers;
begin
  if not public.fn_is_platform_admin() then raise exception 'not authorized: platform admin only'; end if;
  perform set_config('mytree.admin_action', 'true', true);
  update public.customers
  set is_banned = false, banned_reason = null, banned_at = null, banned_by = null
  where id = p_customer_id
  returning * into v_row;
  if not found then raise exception 'customer % not found', p_customer_id; end if;
  return v_row;
end;
$$;

revoke all on function public.fn_approve_shop(text) from public;
revoke all on function public.fn_ban_shop(text,text) from public;
revoke all on function public.fn_unban_shop(text) from public;
revoke all on function public.fn_approve_rider(uuid) from public;
revoke all on function public.fn_ban_rider(uuid,text) from public;
revoke all on function public.fn_unban_rider(uuid) from public;
revoke all on function public.fn_verify_rider_document(uuid) from public;
revoke all on function public.fn_ban_customer(uuid,text) from public;
revoke all on function public.fn_unban_customer(uuid) from public;

grant execute on function public.fn_approve_shop(text) to authenticated, service_role;
grant execute on function public.fn_ban_shop(text,text) to authenticated, service_role;
grant execute on function public.fn_unban_shop(text) to authenticated, service_role;
grant execute on function public.fn_approve_rider(uuid) to authenticated, service_role;
grant execute on function public.fn_ban_rider(uuid,text) to authenticated, service_role;
grant execute on function public.fn_unban_rider(uuid) to authenticated, service_role;
grant execute on function public.fn_verify_rider_document(uuid) to authenticated, service_role;
grant execute on function public.fn_ban_customer(uuid,text) to authenticated, service_role;
grant execute on function public.fn_unban_customer(uuid) to authenticated, service_role;

-- Simulate an existing production admin created under the legacy enum value.
insert into public.customers(id, name)
values ('00000000-0000-0000-0000-000000000002', 'legacy support');

insert into public.platform_admins(customer_id, role)
values ('00000000-0000-0000-0000-000000000002', 'support');
