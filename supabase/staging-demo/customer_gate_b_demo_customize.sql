-- Gate B Customer staging demo Customize.
-- Staging-only data seed. Do not apply to production.
-- Exercises canonical model: Category -> Customize Group -> Options -> Menu Assignment.

insert into public.shop_customize_groups (
  group_id, shop_id, section_name, name, sort_order, is_active, description
) values
  ('8b500001-0000-4000-8000-000000000001', 'demo-a5-baobao-house', 'ซาลาเปา/ติ่มซำ', 'เลือกไส้หลัก', 10, true, 'ต้องเลือก 1 รายการ'),
  ('8b500001-0000-4000-8000-000000000002', 'demo-a5-baobao-house', 'ซาลาเปา/ติ่มซำ', 'เพิ่มเครื่องเคียง', 20, true, 'เลือกเพิ่มได้ไม่เกิน 2 รายการ')
on conflict (group_id) do update set
  shop_id = excluded.shop_id,
  section_name = excluded.section_name,
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  description = excluded.description,
  updated_at = now();

insert into public.shop_customize_options (
  option_id, group_id, label, price_delta, sort_order, is_active, is_default
) values
  ('8b500002-0000-4000-8000-000000000001', '8b500001-0000-4000-8000-000000000001', 'หมูสับไข่ต้ม', 0, 10, true, false),
  ('8b500002-0000-4000-8000-000000000002', '8b500001-0000-4000-8000-000000000001', 'หมูแดง', 5, 20, true, false),
  ('8b500002-0000-4000-8000-000000000003', '8b500001-0000-4000-8000-000000000001', 'คัสตาร์ด', 0, 30, true, false),
  ('8b500002-0000-4000-8000-000000000004', '8b500001-0000-4000-8000-000000000002', 'ขนมจีบหมู 2 ชิ้น', 25, 10, true, false),
  ('8b500002-0000-4000-8000-000000000005', '8b500001-0000-4000-8000-000000000002', 'น้ำจิ้มซีอิ๊วดำ', 0, 20, true, true),
  ('8b500002-0000-4000-8000-000000000006', '8b500001-0000-4000-8000-000000000002', 'ชาจีนเย็น', 15, 30, true, false)
on conflict (option_id) do update set
  group_id = excluded.group_id,
  label = excluded.label,
  price_delta = excluded.price_delta,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  is_default = excluded.is_default,
  updated_at = now();

insert into public.menu_item_customize_groups (
  item_id, group_id, is_required, min_select, max_select, sort_order
) values
  ('8a500001-0000-4000-8000-000000000001', '8b500001-0000-4000-8000-000000000001', true, 1, 1, 10),
  ('8a500001-0000-4000-8000-000000000001', '8b500001-0000-4000-8000-000000000002', false, 0, 2, 20)
on conflict (item_id, group_id) do update set
  is_required = excluded.is_required,
  min_select = excluded.min_select,
  max_select = excluded.max_select,
  sort_order = excluded.sort_order;
