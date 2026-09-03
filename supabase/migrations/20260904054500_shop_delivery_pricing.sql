-- MyTree Shop: checkout-visible delivery pricing policy.
-- Keeps the current distance quote as the default to preserve existing behavior.

alter table public.shops
  add column if not exists delivery_pricing_mode text not null default 'distance',
  add column if not exists delivery_flat_fee numeric(12,2) not null default 0,
  add column if not exists free_delivery_min_order numeric(12,2),
  add column if not exists rider_request_enabled boolean not null default true;

alter table public.shops drop constraint if exists shops_delivery_pricing_mode_check;
alter table public.shops add constraint shops_delivery_pricing_mode_check
  check (delivery_pricing_mode in ('distance', 'flat', 'free'));

alter table public.shops drop constraint if exists shops_delivery_flat_fee_check;
alter table public.shops add constraint shops_delivery_flat_fee_check
  check (delivery_flat_fee >= 0);

alter table public.shops drop constraint if exists shops_free_delivery_min_order_check;
alter table public.shops add constraint shops_free_delivery_min_order_check
  check (free_delivery_min_order is null or free_delivery_min_order >= 0);

comment on column public.shops.delivery_pricing_mode is
  'Customer-facing delivery pricing: distance=existing route quote, flat=merchant configured fee, free=0 fee.';
comment on column public.shops.delivery_flat_fee is
  'Flat delivery fee shown to customer before order confirmation when delivery_pricing_mode=flat.';
comment on column public.shops.free_delivery_min_order is
  'Optional minimum cart subtotal that makes delivery free even when mode is distance or flat.';
comment on column public.shops.rider_request_enabled is
  'Whether the shop may request MyTree Riders after preparing an order; separate from customer-facing delivery pricing.';
