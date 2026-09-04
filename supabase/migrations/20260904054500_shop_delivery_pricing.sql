-- MyTree Shop: customer-visible delivery pricing policy.
-- IMPORTANT: this layer is separate from the existing Rider delivery pricing
-- (`delivery_fee`, `delivery_fee_payer`, rider flat/per-km settings).
-- A customer promotion may make delivery free while the Rider still receives
-- the full Rider fee, paid by the shop instead of the customer.

alter table public.shops
  add column if not exists customer_delivery_pricing_mode text not null default 'distance',
  add column if not exists customer_delivery_flat_fee numeric(12,2) not null default 0,
  add column if not exists customer_free_delivery_min_order numeric(12,2),
  add column if not exists rider_request_enabled boolean not null default true;

alter table public.sub_orders
  add column if not exists customer_delivery_charge numeric(12,2) not null default 0;

alter table public.shops drop constraint if exists shops_customer_delivery_pricing_mode_check;
alter table public.shops add constraint shops_customer_delivery_pricing_mode_check
  check (customer_delivery_pricing_mode in ('distance', 'flat', 'free'));

alter table public.shops drop constraint if exists shops_customer_delivery_flat_fee_check;
alter table public.shops add constraint shops_customer_delivery_flat_fee_check
  check (customer_delivery_flat_fee >= 0);

alter table public.shops drop constraint if exists shops_customer_free_delivery_min_order_check;
alter table public.shops add constraint shops_customer_free_delivery_min_order_check
  check (customer_free_delivery_min_order is null or customer_free_delivery_min_order >= 0);

alter table public.sub_orders drop constraint if exists sub_orders_customer_delivery_charge_check;
alter table public.sub_orders add constraint sub_orders_customer_delivery_charge_check
  check (customer_delivery_charge >= 0);

comment on column public.shops.customer_delivery_pricing_mode is
  'Customer-facing delivery pricing only: distance=route quote, flat=merchant customer charge, free=customer charge 0. Does not change Rider fee.';
comment on column public.shops.customer_delivery_flat_fee is
  'Flat amount charged to the customer when customer_delivery_pricing_mode=flat.';
comment on column public.shops.customer_free_delivery_min_order is
  'Optional cart subtotal threshold that makes the customer delivery charge 0. Rider fee remains payable by the shop.';
comment on column public.shops.rider_request_enabled is
  'Whether the shop may request MyTree Riders after preparing an order; separate from customer-facing delivery pricing.';
comment on column public.sub_orders.customer_delivery_charge is
  'Customer-visible delivery charge frozen at checkout. May be 0 for free-delivery promotions while delivery_fee remains the Rider compensation.';
