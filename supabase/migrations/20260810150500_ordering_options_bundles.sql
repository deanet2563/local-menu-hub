-- MyTree Ordering Flow v2 — additive schema foundation
-- Safe scope: new tables only. Existing order/shop/payment/pre-order columns are NOT changed here.
-- Apply to a staging/live Supabase project only after reviewing the current live schema.

create table if not exists public.menu_option_groups (
  option_group_id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(shop_id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 100),
  description text,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_option_groups_min_max_check check (min_select <= max_select),
  constraint menu_option_groups_required_check check (not is_required or min_select >= 1)
);

create table if not exists public.menu_options (
  option_id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.menu_option_groups(option_group_id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reusable option groups can be attached to many menu items.
create table if not exists public.menu_item_option_groups (
  item_id uuid not null references public.menu_items(item_id) on delete cascade,
  option_group_id uuid not null references public.menu_option_groups(option_group_id) on delete cascade,
  sort_order integer not null default 0,
  primary key (item_id, option_group_id)
);

-- Bundle/set parent. A bundle is intentionally separate from menu_items so that
-- a shop can publish a set without inventing a fake child menu item.
create table if not exists public.menu_bundles (
  bundle_id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(shop_id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 150),
  description text,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  category text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A set may contain multiple groups, e.g. 2 buns + 1 drink.
create table if not exists public.menu_bundle_groups (
  bundle_group_id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.menu_bundles(bundle_id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  min_units integer not null default 1 check (min_units >= 0),
  max_units integer not null default 1 check (max_units >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint menu_bundle_groups_min_max_check check (min_units <= max_units)
);

-- Eligible menu items for each bundle group. Price delta enables premium choices.
create table if not exists public.menu_bundle_group_items (
  bundle_group_id uuid not null references public.menu_bundle_groups(bundle_group_id) on delete cascade,
  item_id uuid not null references public.menu_items(item_id) on delete restrict,
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  sort_order integer not null default 0,
  primary key (bundle_group_id, item_id)
);

-- Optional bundle-level option groups (e.g. packaging / heat whole set).
create table if not exists public.menu_bundle_option_groups (
  bundle_id uuid not null references public.menu_bundles(bundle_id) on delete cascade,
  option_group_id uuid not null references public.menu_option_groups(option_group_id) on delete cascade,
  sort_order integer not null default 0,
  primary key (bundle_id, option_group_id)
);

create index if not exists idx_menu_option_groups_shop on public.menu_option_groups(shop_id, is_active, sort_order);
create index if not exists idx_menu_options_group on public.menu_options(option_group_id, is_active, sort_order);
create index if not exists idx_menu_item_option_groups_item on public.menu_item_option_groups(item_id, sort_order);
create index if not exists idx_menu_bundles_shop on public.menu_bundles(shop_id, is_available, sort_order);
create index if not exists idx_menu_bundle_groups_bundle on public.menu_bundle_groups(bundle_id, sort_order);
create index if not exists idx_menu_bundle_group_items_group on public.menu_bundle_group_items(bundle_group_id, sort_order);

alter table public.menu_option_groups enable row level security;
alter table public.menu_options enable row level security;
alter table public.menu_item_option_groups enable row level security;
alter table public.menu_bundles enable row level security;
alter table public.menu_bundle_groups enable row level security;
alter table public.menu_bundle_group_items enable row level security;
alter table public.menu_bundle_option_groups enable row level security;

-- Public read is limited to active/published ordering configuration.
create policy "public read active option groups" on public.menu_option_groups
  for select using (is_active = true);
create policy "public read active options" on public.menu_options
  for select using (is_active = true);
create policy "public read item option links" on public.menu_item_option_groups
  for select using (true);
create policy "public read available bundles" on public.menu_bundles
  for select using (is_available = true);
create policy "public read bundle groups" on public.menu_bundle_groups
  for select using (true);
create policy "public read bundle items" on public.menu_bundle_group_items
  for select using (true);
create policy "public read bundle option links" on public.menu_bundle_option_groups
  for select using (true);

-- Shop staff write policies use the existing SECURITY DEFINER helper to avoid
-- cross-table RLS recursion. If fn_staff_shop_ids() differs in live DB, stop and
-- reconcile before applying this migration.
create policy "shop staff manage option groups" on public.menu_option_groups
  for all using (shop_id = any(public.fn_staff_shop_ids()))
  with check (shop_id = any(public.fn_staff_shop_ids()));

create policy "shop staff manage options" on public.menu_options
  for all using (
    exists (
      select 1 from public.menu_option_groups g
      where g.option_group_id = menu_options.option_group_id
        and g.shop_id = any(public.fn_staff_shop_ids())
    )
  )
  with check (
    exists (
      select 1 from public.menu_option_groups g
      where g.option_group_id = menu_options.option_group_id
        and g.shop_id = any(public.fn_staff_shop_ids())
    )
  );

create policy "shop staff manage item option links" on public.menu_item_option_groups
  for all using (
    exists (
      select 1 from public.menu_items m
      where m.item_id = menu_item_option_groups.item_id
        and m.shop_id = any(public.fn_staff_shop_ids())
    )
  )
  with check (
    exists (
      select 1 from public.menu_items m
      where m.item_id = menu_item_option_groups.item_id
        and m.shop_id = any(public.fn_staff_shop_ids())
    )
  );

create policy "shop staff manage bundles" on public.menu_bundles
  for all using (shop_id = any(public.fn_staff_shop_ids()))
  with check (shop_id = any(public.fn_staff_shop_ids()));

-- Child-table writes are checked through their parent bundle. If these policies
-- trigger RLS recursion in the live schema, replace the EXISTS checks with a
-- SECURITY DEFINER helper before applying (see project handoff RLS lessons).
create policy "shop staff manage bundle groups" on public.menu_bundle_groups
  for all using (
    exists (
      select 1 from public.menu_bundles b
      where b.bundle_id = menu_bundle_groups.bundle_id
        and b.shop_id = any(public.fn_staff_shop_ids())
    )
  )
  with check (
    exists (
      select 1 from public.menu_bundles b
      where b.bundle_id = menu_bundle_groups.bundle_id
        and b.shop_id = any(public.fn_staff_shop_ids())
    )
  );

create policy "shop staff manage bundle items" on public.menu_bundle_group_items
  for all using (
    exists (
      select 1
      from public.menu_bundle_groups bg
      join public.menu_bundles b on b.bundle_id = bg.bundle_id
      where bg.bundle_group_id = menu_bundle_group_items.bundle_group_id
        and b.shop_id = any(public.fn_staff_shop_ids())
    )
  )
  with check (
    exists (
      select 1
      from public.menu_bundle_groups bg
      join public.menu_bundles b on b.bundle_id = bg.bundle_id
      where bg.bundle_group_id = menu_bundle_group_items.bundle_group_id
        and b.shop_id = any(public.fn_staff_shop_ids())
    )
  );

create policy "shop staff manage bundle option links" on public.menu_bundle_option_groups
  for all using (
    exists (
      select 1 from public.menu_bundles b
      where b.bundle_id = menu_bundle_option_groups.bundle_id
        and b.shop_id = any(public.fn_staff_shop_ids())
    )
  )
  with check (
    exists (
      select 1 from public.menu_bundles b
      where b.bundle_id = menu_bundle_option_groups.bundle_id
        and b.shop_id = any(public.fn_staff_shop_ids())
    )
  );
