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
