-- Gate A.5 Customer staging demo catalog.
-- Staging-only data seed. Do not apply to production.
-- Existing stage-int-* fixtures are intentionally preserved.

insert into public.shops (
  shop_id, name, category, logo_url, delivery_enabled, pickup_enabled,
  is_open, is_approved, is_banned, address
) values
  ('demo-a5-baobao-house', 'บ้านซาลาเปาอาม่า', 'ซาลาเปา/ติ่มซำ', '/staging-demo/bao.svg', true, true, true, true, false, 'โซนตลาดหน้าโครงการ'),
  ('demo-a5-krua-pa-da', 'ครัวป้าแดงตามสั่ง', 'อาหารตามสั่ง', '/staging-demo/rice.svg', true, true, true, true, false, 'หน้าหมู่บ้านสัมมากร'),
  ('demo-a5-rice-roaster', 'ข้าวหมูแดงนายต้น', 'อาหารตามสั่ง', '/staging-demo/rice.svg', true, true, true, true, false, 'ตลาดนัดชุมชน'),
  ('demo-a5-butter-room', 'Butter Room Bakery', 'เบเกอรี่', '/staging-demo/bakery.svg', true, true, true, true, false, 'ล็อก B12'),
  ('demo-a5-kanom-thai', 'ขนมไทยแม่อร', 'ขนมไทย', '/staging-demo/thai-dessert.svg', true, true, true, true, false, 'ใกล้สวนกลาง'),
  ('demo-a5-cha-baan', 'ชาบ้านบ้าน', 'เครื่องดื่ม/ชา/กาแฟ', '/staging-demo/drinks.svg', true, true, true, true, false, 'หน้าเซเว่น'),
  ('demo-a5-noodle-lane', 'ก๋วยเตี๋ยวหมูตุ๋นซอย 3', 'ก๋วยเตี๋ยว', '/staging-demo/noodles.svg', true, true, true, true, false, 'ซอย 3'),
  ('demo-a5-cafe-green', 'Green Yard Cafe', 'คาเฟ่', '/staging-demo/cafe.svg', true, true, true, true, false, 'ริมสวนชุมชน')
on conflict (shop_id) do update set
  name = excluded.name,
  category = excluded.category,
  logo_url = excluded.logo_url,
  delivery_enabled = excluded.delivery_enabled,
  pickup_enabled = excluded.pickup_enabled,
  is_open = excluded.is_open,
  is_approved = excluded.is_approved,
  is_banned = excluded.is_banned,
  address = excluded.address;

insert into public.menu_items (item_id, shop_id, name, price, category, image_url, is_available) values
  ('8a500001-0000-4000-8000-000000000001', 'demo-a5-baobao-house', 'ซาลาเปาหมูสับไข่ต้ม', 32, 'ซาลาเปา/ติ่มซำ', '/staging-demo/bao.svg', true),
  ('8a500001-0000-4000-8000-000000000002', 'demo-a5-baobao-house', 'ซาลาเปาคัสตาร์ด', 28, 'ซาลาเปา/ติ่มซำ', '/staging-demo/bao.svg', true),
  ('8a500001-0000-4000-8000-000000000003', 'demo-a5-baobao-house', 'ขนมจีบหมู', 45, 'ซาลาเปา/ติ่มซำ', '/staging-demo/bao.svg', true),
  ('8a500001-0000-4000-8000-000000000006', 'demo-a5-krua-pa-da', 'ข้าวกะเพราไก่ไข่ดาว', 65, 'อาหารตามสั่ง', '/staging-demo/rice.svg', true),
  ('8a500001-0000-4000-8000-000000000007', 'demo-a5-krua-pa-da', 'ข้าวผัดหมู', 60, 'อาหารตามสั่ง', '/staging-demo/rice.svg', true),
  ('8a500001-0000-4000-8000-000000000008', 'demo-a5-krua-pa-da', 'ข้าวไข่เจียวหมูสับ', 50, 'อาหารตามสั่ง', '/staging-demo/rice.svg', true),
  ('8a500001-0000-4000-8000-000000000009', 'demo-a5-rice-roaster', 'ข้าวหมูแดง', 65, 'อาหารตามสั่ง', '/staging-demo/rice.svg', true),
  ('8a500001-0000-4000-8000-000000000010', 'demo-a5-rice-roaster', 'ข้าวหมูกรอบ', 75, 'อาหารตามสั่ง', '/staging-demo/rice.svg', true),
  ('8a500001-0000-4000-8000-000000000011', 'demo-a5-butter-room', 'ครัวซองต์เนยสด', 69, 'เบเกอรี่', '/staging-demo/bakery.svg', true),
  ('8a500001-0000-4000-8000-000000000012', 'demo-a5-butter-room', 'เค้กส้ม', 85, 'เบเกอรี่', '/staging-demo/bakery.svg', true),
  ('8a500001-0000-4000-8000-000000000013', 'demo-a5-butter-room', 'ขนมปังกระเทียมชีส', 59, 'เบเกอรี่', '/staging-demo/bakery.svg', true),
  ('8a500001-0000-4000-8000-000000000014', 'demo-a5-kanom-thai', 'ข้าวเหนียวขมิ้นหน้าปลาแห้ง', 45, 'ขนมไทย', '/staging-demo/thai-dessert.svg', true),
  ('8a500001-0000-4000-8000-000000000015', 'demo-a5-kanom-thai', 'บัวลอยไข่หวาน', 42, 'ขนมไทย', '/staging-demo/thai-dessert.svg', true),
  ('8a500001-0000-4000-8000-000000000016', 'demo-a5-kanom-thai', 'ตะโก้เผือก', 35, 'ขนมไทย', '/staging-demo/thai-dessert.svg', true),
  ('8a500001-0000-4000-8000-000000000017', 'demo-a5-cha-baan', 'ชาไทย', 40, 'เครื่องดื่ม/ชา/กาแฟ', '/staging-demo/drinks.svg', true),
  ('8a500001-0000-4000-8000-000000000018', 'demo-a5-cha-baan', 'มัทฉะลาเต้', 65, 'เครื่องดื่ม/ชา/กาแฟ', '/staging-demo/drinks.svg', true),
  ('8a500001-0000-4000-8000-000000000019', 'demo-a5-cha-baan', 'กาแฟเย็น', 45, 'เครื่องดื่ม/ชา/กาแฟ', '/staging-demo/drinks.svg', true),
  ('8a500001-0000-4000-8000-000000000020', 'demo-a5-noodle-lane', 'ก๋วยเตี๋ยวหมูตุ๋น', 65, 'ก๋วยเตี๋ยว', '/staging-demo/noodles.svg', true),
  ('8a500001-0000-4000-8000-000000000021', 'demo-a5-noodle-lane', 'บะหมี่แห้งหมูแดง', 60, 'ก๋วยเตี๋ยว', '/staging-demo/noodles.svg', true),
  ('8a500001-0000-4000-8000-000000000022', 'demo-a5-noodle-lane', 'เกาเหลาหมูตุ๋น', 75, 'ก๋วยเตี๋ยว', '/staging-demo/noodles.svg', true),
  ('8a500001-0000-4000-8000-000000000023', 'demo-a5-cafe-green', 'ลาเต้เย็น', 70, 'คาเฟ่', '/staging-demo/cafe.svg', true),
  ('8a500001-0000-4000-8000-000000000024', 'demo-a5-cafe-green', 'อเมริกาโน่น้ำผึ้ง', 75, 'คาเฟ่', '/staging-demo/cafe.svg', true),
  ('8a500001-0000-4000-8000-000000000025', 'demo-a5-cafe-green', 'แซนด์วิชแฮมชีส', 89, 'คาเฟ่', '/staging-demo/meal.svg', true)
on conflict (item_id) do update set
  shop_id = excluded.shop_id,
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  image_url = excluded.image_url,
  is_available = excluded.is_available;
