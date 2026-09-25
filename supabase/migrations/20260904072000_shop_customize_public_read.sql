-- Customer storefront read access for active merchant-managed categories/customize config.
-- Writes remain staff-only from the base migration.

alter table public.shop_menu_categories enable row level security;
alter table public.shop_customize_groups enable row level security;
alter table public.shop_customize_options enable row level security;
alter table public.menu_item_customize_groups enable row level security;

drop policy if exists shop_menu_categories_public_select on public.shop_menu_categories;
create policy shop_menu_categories_public_select on public.shop_menu_categories
for select using (
  is_active
  and exists (
    select 1 from public.shops s
    where s.shop_id = shop_menu_categories.shop_id
      and s.is_approved = true
      and coalesce(s.is_banned, false) = false
  )
);

drop policy if exists shop_customize_groups_public_select on public.shop_customize_groups;
create policy shop_customize_groups_public_select on public.shop_customize_groups
for select using (
  is_active
  and exists (
    select 1 from public.shops s
    where s.shop_id = shop_customize_groups.shop_id
      and s.is_approved = true
      and coalesce(s.is_banned, false) = false
  )
);

drop policy if exists shop_customize_options_public_select on public.shop_customize_options;
create policy shop_customize_options_public_select on public.shop_customize_options
for select using (
  is_active
  and exists (
    select 1
    from public.shop_customize_groups g
    join public.shops s on s.shop_id = g.shop_id
    where g.group_id = shop_customize_options.group_id
      and g.is_active = true
      and s.is_approved = true
      and coalesce(s.is_banned, false) = false
  )
);

drop policy if exists menu_item_customize_groups_public_select on public.menu_item_customize_groups;
create policy menu_item_customize_groups_public_select on public.menu_item_customize_groups
for select using (
  exists (
    select 1
    from public.menu_items m
    join public.shops s on s.shop_id = m.shop_id
    join public.shop_customize_groups g on g.group_id = menu_item_customize_groups.group_id and g.shop_id = m.shop_id
    where m.item_id = menu_item_customize_groups.item_id
      and m.is_available = true
      and g.is_active = true
      and s.is_approved = true
      and coalesce(s.is_banned, false) = false
  )
);