-- MyTree Rider Job V2
-- Delivery fee payer has exactly two values: customer or shop.
-- No split/shared delivery-fee option by design.

alter table public.sub_orders
  add column if not exists delivery_fee numeric(10,2) not null default 40,
  add column if not exists delivery_fee_payer text not null default 'customer',
  add column if not exists delivery_distance_km numeric(10,3),
  add column if not exists delivery_destination_lat double precision,
  add column if not exists delivery_destination_lng double precision;

alter table public.sub_orders
  drop constraint if exists sub_orders_delivery_fee_payer_check;

alter table public.sub_orders
  add constraint sub_orders_delivery_fee_payer_check
  check (delivery_fee_payer in ('customer', 'shop'));

alter table public.shops
  add column if not exists delivery_pricing_mode text not null default 'flat_zone',
  add column if not exists delivery_flat_fee numeric(10,2) not null default 40,
  add column if not exists delivery_per_km_rate numeric(10,2) not null default 10,
  add column if not exists delivery_min_fee numeric(10,2) not null default 40,
  add column if not exists delivery_default_fee_payer text not null default 'customer';

alter table public.shops
  drop constraint if exists shops_delivery_pricing_mode_check;
alter table public.shops
  add constraint shops_delivery_pricing_mode_check
  check (delivery_pricing_mode in ('flat_zone', 'per_km'));

alter table public.shops
  drop constraint if exists shops_delivery_default_fee_payer_check;
alter table public.shops
  add constraint shops_delivery_default_fee_payer_check
  check (delivery_default_fee_payer in ('customer', 'shop'));

comment on column public.sub_orders.delivery_fee is
  'Amount Rider collects for delivery. Customer-facing promotions do not reduce this amount unless the shop explicitly changes the delivery fee.';
comment on column public.sub_orders.delivery_fee_payer is
  'Who Rider collects the delivery fee from: customer or shop only.';
comment on column public.sub_orders.delivery_distance_km is
  'Shop-to-customer delivery distance snapshot used for Rider decision and fee calculation.';
comment on column public.shops.delivery_pricing_mode is
  'flat_zone or per_km. Initial Sammakorn model uses flat_zone 40 THB.';

-- Safe V2 wrapper around the already-proven Rider nearby-job RPC.
-- It exposes destination/address + delivery commercial facts needed by Rider
-- before expressing interest, while still excluding customer name/phone.
create or replace function public.fn_rider_nearby_delivery_jobs_v2(
  p_radius_km numeric default 1
)
returns table (
  sub_id uuid,
  shop_id text,
  shop_name text,
  shop_address text,
  shop_lat double precision,
  shop_lng double precision,
  distance_to_shop_km double precision,
  confirmed_at timestamptz,
  created_at timestamptz,
  delivery_address_preview text,
  delivery_distance_km numeric,
  delivery_fee numeric,
  delivery_fee_payer text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    base.sub_id,
    base.shop_id,
    base.shop_name,
    base.shop_address,
    base.shop_lat,
    base.shop_lng,
    base.distance_to_shop_km,
    base.confirmed_at,
    so.created_at,
    so.delivery_address as delivery_address_preview,
    so.delivery_distance_km,
    so.delivery_fee,
    so.delivery_fee_payer
  from public.fn_rider_nearby_delivery_jobs(p_radius_km) as base
  join public.sub_orders so on so.sub_id = base.sub_id
  order by coalesce(base.confirmed_at, so.created_at) desc;
$$;

grant execute on function public.fn_rider_nearby_delivery_jobs_v2(numeric) to authenticated;
