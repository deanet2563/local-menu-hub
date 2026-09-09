-- MyTree Shop: merchant-managed menu categories and reusable customize library
-- Production compatibility: shops.shop_id is text and fn_staff_shop_ids() returns SETOF text.

create table if not exists public.shop_menu_categories (
  category_id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(shop_id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table if not exists public.shop_customize_groups (
  group_id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(shop_id) on delete cascade,
  section_name text not null default 'ทั่วไป',
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, section_name, name)
);

create table if not exists public.shop_customize_options (
  option_id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.shop_customize_groups(group_id) on delete cascade,
  label text not null,
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, label)
);

create table if not exists public.menu_item_customize_groups (
  item_id uuid not null references public.menu_items(item_id) on delete cascade,
  group_id uuid not null references public.shop_customize_groups(group_id) on delete cascade,
  is_required boolean not null default false,
  min_select integer not null default 0,
  max_select integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (item_id, group_id),
  check (min_select >= 0),
  check (max_select >= 1),
  check (min_select <= max_select),
  check (not is_required or min_select >= 1)
);

create index if not exists idx_shop_menu_categories_shop on public.shop_menu_categories(shop_id, sort_order);
create index if not exists idx_shop_customize_groups_shop on public.shop_customize_groups(shop_id, section_name, sort_order);
create index if not exists idx_shop_customize_options_group on public.shop_customize_options(group_id, sort_order);
create index if not exists idx_menu_item_customize_groups_item on public.menu_item_customize_groups(item_id, sort_order);

alter table public.shop_menu_categories enable row level security;
alter table public.shop_customize_groups enable row level security;
alter table public.shop_customize_options enable row level security;
alter table public.menu_item_customize_groups enable row level security;

drop policy if exists shop_menu_categories_staff_all on public.shop_menu_categories;
create policy shop_menu_categories_staff_all on public.shop_menu_categories
for all using (shop_id in (select public.fn_staff_shop_ids()))
with check (shop_id in (select public.fn_staff_shop_ids()));

drop policy if exists shop_customize_groups_staff_all on public.shop_customize_groups;
create policy shop_customize_groups_staff_all on public.shop_customize_groups
for all using (shop_id in (select public.fn_staff_shop_ids()))
with check (shop_id in (select public.fn_staff_shop_ids()));

drop policy if exists shop_customize_options_staff_all on public.shop_customize_options;
create policy shop_customize_options_staff_all on public.shop_customize_options
for all using (
  exists (
    select 1 from public.shop_customize_groups g
    where g.group_id = shop_customize_options.group_id
      and g.shop_id in (select public.fn_staff_shop_ids())
  )
)
with check (
  exists (
    select 1 from public.shop_customize_groups g
    where g.group_id = shop_customize_options.group_id
      and g.shop_id in (select public.fn_staff_shop_ids())
  )
);

drop policy if exists menu_item_customize_groups_staff_all on public.menu_item_customize_groups;
create policy menu_item_customize_groups_staff_all on public.menu_item_customize_groups
for all using (
  exists (
    select 1 from public.menu_items m
    where m.item_id = menu_item_customize_groups.item_id
      and m.shop_id in (select public.fn_staff_shop_ids())
  )
)
with check (
  exists (
    select 1 from public.menu_items m
    join public.shop_customize_groups g on g.group_id = menu_item_customize_groups.group_id
    where m.item_id = menu_item_customize_groups.item_id
      and m.shop_id = g.shop_id
      and m.shop_id in (select public.fn_staff_shop_ids())
  )
);
