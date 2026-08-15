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
  add column if not exists delivery_default_fee_payer text not null default 'customer',
  add column if not exists delivery_free_over_amount numeric(10,2);

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
  'Amount Rider collects for delivery. Customer-facing promotions do not reduce this amount unless the shop explicitly changes the Rider delivery fee.';
comment on column public.sub_orders.delivery_fee_payer is
  'Who Rider collects the delivery fee from: customer or shop only.';
comment on column public.sub_orders.delivery_distance_km is
  'Shop-to-customer delivery distance snapshot used for Rider decision and fee calculation.';
comment on column public.shops.delivery_pricing_mode is
  'flat_zone or per_km. Initial Sammakorn model uses flat_zone 40 THB.';
comment on column public.shops.delivery_free_over_amount is
  'Optional customer promotion threshold. When used by checkout, the shop pays the Rider fee; Rider fee itself is not reduced.';

-- Calculate and freeze the shop -> destination distance and Rider fee on the order.
-- This uses coordinates already captured by checkout. It does not geocode text addresses.
create or replace function public.fn_apply_delivery_pricing_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_shop_lat double precision;
  v_shop_lng double precision;
  v_mode text;
  v_flat numeric;
  v_rate numeric;
  v_min numeric;
  v_a double precision;
  v_distance double precision;
begin
  if new.fulfillment_type::text <> 'delivery' then
    return new;
  end if;

  select
    s.lat,
    s.lng,
    s.delivery_pricing_mode,
    s.delivery_flat_fee,
    s.delivery_per_km_rate,
    s.delivery_min_fee
  into
    v_shop_lat,
    v_shop_lng,
    v_mode,
    v_flat,
    v_rate,
    v_min
  from public.shops s
  where s.shop_id = new.shop_id;

  if v_shop_lat is not null
     and v_shop_lng is not null
     and new.delivery_destination_lat is not null
     and new.delivery_destination_lng is not null then
    v_a :=
      power(sin(radians(new.delivery_destination_lat - v_shop_lat) / 2), 2)
      + cos(radians(v_shop_lat))
      * cos(radians(new.delivery_destination_lat))
      * power(sin(radians(new.delivery_destination_lng - v_shop_lng) / 2), 2);
    v_a := least(1.0, greatest(0.0, v_a));
    v_distance := 6371.0 * 2.0 * asin(sqrt(v_a));
    new.delivery_distance_km := round(v_distance::numeric, 3);
  end if;

  if coalesce(v_mode, 'flat_zone') = 'per_km' and new.delivery_distance_km is not null then
    new.delivery_fee := greatest(coalesce(v_min, 40), ceil(new.delivery_distance_km * coalesce(v_rate, 10)));
  else
    new.delivery_fee := coalesce(v_flat, 40);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_delivery_pricing_snapshot on public.sub_orders;
create trigger trg_apply_delivery_pricing_snapshot
before insert or update of shop_id, fulfillment_type, delivery_destination_lat, delivery_destination_lng
on public.sub_orders
for each row
execute function public.fn_apply_delivery_pricing_snapshot();

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
    base.sub_id::uuid,
    base.shop_id::text,
    base.shop_name::text,
    base.shop_address::text,
    base.shop_lat::double precision,
    base.shop_lng::double precision,
    base.distance_to_shop_km::double precision,
    base.confirmed_at::timestamptz,
    so.created_at::timestamptz,
    so.delivery_address::text as delivery_address_preview,
    so.delivery_distance_km::numeric,
    so.delivery_fee::numeric,
    so.delivery_fee_payer::text
  from public.fn_rider_nearby_delivery_jobs(p_radius_km) as base
  join public.sub_orders so on so.sub_id = base.sub_id
  order by coalesce(base.confirmed_at::timestamptz, so.created_at) desc;
$$;

grant execute on function public.fn_rider_nearby_delivery_jobs_v2(numeric) to authenticated;
