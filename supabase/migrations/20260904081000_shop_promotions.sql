-- MyTree Shop promotions: merchant-managed banners shown above the customer menu.
-- Production compatibility: shops.shop_id is text and fn_staff_shop_ids() returns SETOF text.

create table if not exists public.shop_promotions (
  promotion_id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(shop_id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  description text,
  banner_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_promotions_description_length check (description is null or length(description) <= 1000),
  constraint shop_promotions_time_order check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists idx_shop_promotions_shop_active
  on public.shop_promotions(shop_id, is_active, sort_order, created_at desc);

alter table public.shop_promotions enable row level security;

drop policy if exists shop_promotions_staff_all on public.shop_promotions;
create policy shop_promotions_staff_all on public.shop_promotions
for all using (shop_id in (select public.fn_staff_shop_ids()))
with check (shop_id in (select public.fn_staff_shop_ids()));

drop policy if exists shop_promotions_public_select on public.shop_promotions;
create policy shop_promotions_public_select on public.shop_promotions
for select using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
  and exists (
    select 1 from public.shops s
    where s.shop_id = shop_promotions.shop_id
      and s.is_approved = true
      and coalesce(s.is_banned, false) = false
  )
);
