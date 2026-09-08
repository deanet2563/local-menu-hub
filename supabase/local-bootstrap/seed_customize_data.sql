-- LOCAL/TEST ONLY. Representative legacy Customize data for canonical migration rehearsal.
-- ASCII fixture text keeps Windows PowerShell -> psql transport deterministic.
\set ON_ERROR_STOP on

insert into public.shops (shop_id, name, category, pickup_enabled, delivery_enabled, is_open, is_approved)
values ('seed-shop-a', 'Local Rehearsal Shop A', 'food', true, true, true, true), ('seed-shop-b', 'Local Rehearsal Shop B', 'drink', true, true, true, true);

insert into public.menu_items (item_id, shop_id, name, price, category, is_available)
values
  ('10000000-0000-0000-0000-000000000001', 'seed-shop-a', 'A Dessert Upper', 40, 'Desserts', true),
  ('10000000-0000-0000-0000-000000000002', 'seed-shop-a', 'A Dessert Spaced', 45, ' desserts ', true),
  ('10000000-0000-0000-0000-000000000003', 'seed-shop-a', 'A Drink', 35, 'Drinks', true),
  ('10000000-0000-0000-0000-000000000004', 'seed-shop-a', 'A Uncategorized Null', 20, null, true),
  ('10000000-0000-0000-0000-000000000005', 'seed-shop-a', 'A Uncategorized Empty', 25, '', true),
  ('10000000-0000-0000-0000-000000000006', 'seed-shop-a', 'A Ownership Conflict', 30, 'Drinks', true),
  ('20000000-0000-0000-0000-000000000001', 'seed-shop-b', 'B Bakery', 50, 'Bakery', true),
  ('20000000-0000-0000-0000-000000000002', 'seed-shop-b', 'B Bakery Case', 55, ' bakery ', true),
  ('20000000-0000-0000-0000-000000000003', 'seed-shop-b', 'B Seasonal', 60, 'Seasonal', false);

insert into public.shop_menu_categories (category_id, shop_id, name, sort_order, is_active)
values
  ('30000000-0000-0000-0000-000000000001', 'seed-shop-a', 'Desserts', 0, true),
  ('30000000-0000-0000-0000-000000000002', 'seed-shop-a', 'desserts', 1, true),
  ('30000000-0000-0000-0000-000000000003', 'seed-shop-b', 'Bakery', 0, true);

insert into public.menu_option_groups (option_group_id, shop_id, name, description, min_select, max_select, is_required, is_active, sort_order)
values
  ('40000000-0000-0000-0000-000000000001', 'seed-shop-a', 'Milk Level', 'Required milk level', 1, 1, true, true, 0),
  ('40000000-0000-0000-0000-000000000002', 'seed-shop-a', 'Toppings', 'Optional toppings', 0, 3, false, true, 1),
  ('40000000-0000-0000-0000-000000000003', 'seed-shop-a', 'Inactive Group', 'Inactive group', 1, 2, true, false, 2),
  ('40000000-0000-0000-0000-000000000004', 'seed-shop-b', 'Milk Level', 'Shop B required milk', 1, 1, true, true, 0),
  ('40000000-0000-0000-0000-000000000005', 'seed-shop-b', 'Toppings', 'Shop B multi choice', 1, 3, false, true, 1),
  ('40000000-0000-0000-0000-000000000006', 'seed-shop-b', 'Cross Shop Group', 'Ownership mismatch candidate', 0, 1, false, true, 2),
  ('40000000-0000-0000-0000-000000000007', 'seed-shop-a', 'Orphan Group', 'Orphan group', 0, 2, false, true, 3);

insert into public.menu_options (option_id, option_group_id, name, price_delta, is_default, is_active, sort_order)
values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Milk Low', 0, true, true, 0),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Milk High', 10.50, false, true, 1),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Milk Inactive', 20, false, false, 2),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Pearl', 5, true, true, 0),
  ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', 'Cream', 8, true, true, 1),
  ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', 'Sauce Inactive', 3, false, false, 2),
  ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', 'Inactive Choice', 2, true, false, 0),
  ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000004', 'B Milk Low', 0, true, true, 0),
  ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000004', 'B Milk High', 12, false, true, 1),
  ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000005', 'B Pearl', 6, true, true, 0),
  ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000005', 'B Jelly', 4, false, true, 1),
  ('50000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000006', 'Cross Option', 9, false, true, 0),
  ('50000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000007', 'Orphan Option', 7, false, true, 0);

insert into public.menu_item_option_groups (item_id, option_group_id, sort_order)
values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 1),
  ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', 1),
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 0),
  ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000005', 0),
  ('10000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', 0),
  ('10000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000007', 0);

insert into public.shop_customize_groups (group_id, shop_id, category_id, section_name, name, description, sort_order, is_active)
values
  ('60000000-0000-0000-0000-000000000001', 'seed-shop-a', '30000000-0000-0000-0000-000000000001', 'Desserts', 'Milk Level', 'Pre-existing conflicting description', 99, false),
  ('60000000-0000-0000-0000-000000000010', 'seed-shop-b', '30000000-0000-0000-0000-000000000003', 'Bakery', 'Pre-existing preserved group', 'Must survive rollback', 98, true);

select 'seed_shops' as metric, count(*)::bigint as row_count from public.shops where shop_id like 'seed-shop-%'
union all select 'seed_items', count(*) from public.menu_items where shop_id like 'seed-shop-%'
union all select 'seed_legacy_groups', count(*) from public.menu_option_groups where shop_id like 'seed-shop-%'
union all select 'seed_legacy_options', count(*) from public.menu_options where option_group_id in (select option_group_id from public.menu_option_groups where shop_id like 'seed-shop-%')
union all select 'seed_legacy_assignments', count(*) from public.menu_item_option_groups where item_id in (select item_id from public.menu_items where shop_id like 'seed-shop-%')
union all select 'seed_existing_canonical_categories', count(*) from public.shop_menu_categories where shop_id like 'seed-shop-%'
union all select 'seed_existing_canonical_groups', count(*) from public.shop_customize_groups where shop_id like 'seed-shop-%';
