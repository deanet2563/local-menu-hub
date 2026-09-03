-- MyTree Premium / Trust Badge foundation.
-- Premium is a commercial eligibility layer; trust badges such as MyTree Verified cannot be purchased directly.

create table if not exists public.shop_memberships (
  shop_id uuid primary key references public.shops(shop_id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
  status text not null default 'active' check (status in ('active','past_due','cancelled','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_verification_requests (
  request_id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(shop_id) on delete cascade,
  verification_type text not null default 'mytree_verified' check (verification_type in ('mytree_verified')),
  status text not null default 'pending' check (status in ('pending','in_review','approved','rejected','cancelled')),
  merchant_note text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.customers(id),
  unique (shop_id, verification_type, status)
);

create table if not exists public.shop_badges (
  badge_id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(shop_id) on delete cascade,
  badge_code text not null,
  label text not null,
  badge_source text not null default 'mytree' check (badge_source in ('mytree','reputation','business_history','media','external_review')),
  icon_url text,
  external_url text,
  awarded_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  awarded_by uuid references public.customers(id),
  metadata jsonb not null default '{}'::jsonb,
  unique (shop_id, badge_code)
);

create index if not exists idx_shop_verification_requests_shop on public.shop_verification_requests(shop_id, requested_at desc);
create index if not exists idx_shop_badges_shop_active on public.shop_badges(shop_id, is_active);

alter table public.shop_memberships enable row level security;
alter table public.shop_verification_requests enable row level security;
alter table public.shop_badges enable row level security;

drop policy if exists shop_memberships_owner_select on public.shop_memberships;
create policy shop_memberships_owner_select on public.shop_memberships
for select using (shop_id = any(public.fn_staff_shop_ids()) or public.fn_is_platform_admin());

drop policy if exists shop_badges_public_select on public.shop_badges;
create policy shop_badges_public_select on public.shop_badges
for select using (is_active = true or shop_id = any(public.fn_staff_shop_ids()) or public.fn_is_platform_admin());

drop policy if exists shop_verification_requests_staff_select on public.shop_verification_requests;
create policy shop_verification_requests_staff_select on public.shop_verification_requests
for select using (shop_id = any(public.fn_staff_shop_ids()) or public.fn_is_platform_admin());

create or replace function public.fn_request_mytree_verification(p_shop_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_is_premium boolean;
begin
  if not (p_shop_id = any(public.fn_staff_shop_ids())) then
    raise exception 'not_authorized_for_shop';
  end if;

  select exists (
    select 1 from public.shop_memberships m
    where m.shop_id = p_shop_id
      and m.plan = 'premium'
      and m.status = 'active'
      and (m.ends_at is null or m.ends_at > now())
  ) into v_is_premium;

  if not v_is_premium then
    raise exception 'premium_required_for_verification';
  end if;

  if exists (
    select 1 from public.shop_verification_requests r
    where r.shop_id = p_shop_id
      and r.verification_type = 'mytree_verified'
      and r.status in ('pending','in_review')
  ) then
    select r.request_id into v_request_id
    from public.shop_verification_requests r
    where r.shop_id = p_shop_id
      and r.verification_type = 'mytree_verified'
      and r.status in ('pending','in_review')
    order by r.requested_at desc limit 1;
    return v_request_id;
  end if;

  insert into public.shop_verification_requests(shop_id, verification_type, status, merchant_note)
  values (p_shop_id, 'mytree_verified', 'pending', nullif(trim(p_note), ''))
  returning request_id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.fn_request_mytree_verification(uuid, text) to authenticated;

-- Membership status and trust-badge awards are intentionally not writable by shop clients.
-- Payment/admin workflows will own these writes. Verification approval should award `mytree_verified`
-- only after the MyTree Team review succeeds; Premium alone never creates the badge automatically.
