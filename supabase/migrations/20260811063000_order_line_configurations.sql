-- MyTree Ordering Flow v2 — immutable configuration snapshots
-- Additive only. Does not modify fn_create_order or existing order columns.
-- Worker (service role) writes one row per configured cart line after order creation.

create table if not exists public.order_line_configurations (
  id uuid primary key default gen_random_uuid(),
  sub_id uuid not null references public.sub_orders(sub_id) on delete cascade,
  shop_id text not null references public.shops(shop_id) on delete restrict,
  line_ref text not null,
  line_kind text not null check (line_kind in ('item', 'bundle')),
  menu_item_id uuid references public.menu_items(item_id) on delete set null,
  bundle_id uuid references public.menu_bundles(bundle_id) on delete set null,
  item_name_snapshot text not null,
  base_price_snapshot numeric(12,2) not null check (base_price_snapshot >= 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  qty integer not null check (qty > 0),
  options_snapshot jsonb not null default '[]'::jsonb,
  bundle_selections_snapshot jsonb not null default '[]'::jsonb,
  item_note text,
  created_at timestamptz not null default now(),
  constraint order_line_configurations_target_check check (
    (line_kind = 'item' and menu_item_id is not null and bundle_id is null)
    or
    (line_kind = 'bundle' and bundle_id is not null and menu_item_id is null)
  ),
  unique (sub_id, line_ref)
);

create index if not exists idx_order_line_configurations_sub
  on public.order_line_configurations(sub_id, created_at);
create index if not exists idx_order_line_configurations_shop
  on public.order_line_configurations(shop_id, created_at desc);

alter table public.order_line_configurations enable row level security;

-- Shop staff may read snapshots for their own shop. Writes are performed by the
-- Worker service role so we deliberately do not expose client write policies.
create policy "shop staff read order line configurations"
  on public.order_line_configurations
  for select
  using (shop_id = any(public.fn_staff_shop_ids()));
