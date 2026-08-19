create table if not exists public.shop_push_devices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(shop_id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios','android')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_push_devices_shop_id_idx
  on public.shop_push_devices(shop_id)
  where enabled = true;

alter table public.shop_push_devices enable row level security;

create policy "shop staff can read own push devices"
on public.shop_push_devices
for select
to authenticated
using (
  exists (
    select 1
    from public.shop_staff ss
    where ss.shop_id = shop_push_devices.shop_id
      and ss.customer_id = auth.uid()
  )
);

create policy "shop staff can register own push devices"
on public.shop_push_devices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.shop_staff ss
    where ss.shop_id = shop_push_devices.shop_id
      and ss.customer_id = auth.uid()
  )
);

create policy "shop staff can update own push devices"
on public.shop_push_devices
for update
to authenticated
using (
  exists (
    select 1
    from public.shop_staff ss
    where ss.shop_id = shop_push_devices.shop_id
      and ss.customer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.shop_staff ss
    where ss.shop_id = shop_push_devices.shop_id
      and ss.customer_id = auth.uid()
  )
);
