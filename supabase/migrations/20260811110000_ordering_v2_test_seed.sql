-- MyTree Ordering Flow v2 — preview/test seed data
-- Purpose: make the preview branch testable before the LINE OA / LIFF preview
-- entry point is wired. This migration is idempotent and only adds rows whose
-- names contain "(TEST)" for easy identification/removal later.
--
-- Target shop is resolved from existing data (shop name containing SonBaoBao)
-- rather than hard-coding a shop_id or menu item UUID.

DO $$
DECLARE
  v_shop_id text;
  v_heat_group uuid;
  v_dimsum_group uuid;
  v_pack_group uuid;
  v_bundle_id uuid;
  v_bundle_group_id uuid;
BEGIN
  SELECT s.shop_id
    INTO v_shop_id
  FROM public.shops s
  WHERE s.name ILIKE '%SonBaoBao%'
  ORDER BY s.created_at NULLS LAST
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE NOTICE 'Ordering v2 TEST seed skipped: SonBaoBao shop not found';
    RETURN;
  END IF;

  -- ----------------------------------------------------------
  -- 1) Shared required option: bun heating / serving condition
  -- ----------------------------------------------------------
  SELECT g.option_group_id
    INTO v_heat_group
  FROM public.menu_option_groups g
  WHERE g.shop_id = v_shop_id
    AND g.name = 'การอุ่น (TEST)'
  LIMIT 1;

  IF v_heat_group IS NULL THEN
    INSERT INTO public.menu_option_groups (
      shop_id, name, description, min_select, max_select,
      is_required, is_active, sort_order
    ) VALUES (
      v_shop_id,
      'การอุ่น (TEST)',
      'ข้อมูลตัวอย่างสำหรับทดสอบตัวเลือกแบบบังคับเลือก 1 รายการ',
      1, 1, true, true, 10
    )
    RETURNING option_group_id INTO v_heat_group;
  END IF;

  INSERT INTO public.menu_options (
    option_group_id, name, price_delta, is_default, is_active, sort_order
  )
  SELECT v_heat_group, x.name, x.price_delta, x.is_default, true, x.sort_order
  FROM (VALUES
    ('อุ่นพร้อมทาน', 0::numeric, true, 10),
    ('ไม่อุ่น',       0::numeric, false, 20),
    ('รับแบบเย็น',    0::numeric, false, 30)
  ) AS x(name, price_delta, is_default, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_options o
    WHERE o.option_group_id = v_heat_group AND o.name = x.name
  );

  INSERT INTO public.menu_item_option_groups (item_id, option_group_id, sort_order)
  SELECT m.item_id, v_heat_group, 10
  FROM public.menu_items m
  WHERE m.shop_id = v_shop_id
    AND m.name IN ('ซาลาเปาไส้ครีม', 'ซาลาเปาหมูสับ')
  ON CONFLICT (item_id, option_group_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- 2) Optional multi-select extras with a price delta
  -- ----------------------------------------------------------
  SELECT g.option_group_id
    INTO v_dimsum_group
  FROM public.menu_option_groups g
  WHERE g.shop_id = v_shop_id
    AND g.name = 'ของเพิ่มสำหรับขนมจีบ (TEST)'
  LIMIT 1;

  IF v_dimsum_group IS NULL THEN
    INSERT INTO public.menu_option_groups (
      shop_id, name, description, min_select, max_select,
      is_required, is_active, sort_order
    ) VALUES (
      v_shop_id,
      'ของเพิ่มสำหรับขนมจีบ (TEST)',
      'ข้อมูลตัวอย่างสำหรับทดสอบ multi-select และราคาเพิ่ม',
      0, 2, false, true, 20
    )
    RETURNING option_group_id INTO v_dimsum_group;
  END IF;

  INSERT INTO public.menu_options (
    option_group_id, name, price_delta, is_default, is_active, sort_order
  )
  SELECT v_dimsum_group, x.name, x.price_delta, false, true, x.sort_order
  FROM (VALUES
    ('เพิ่มน้ำจิ้ม',       0::numeric, 10),
    ('เพิ่มกระเทียมเจียว', 5::numeric, 20),
    ('เพิ่มพริก',          0::numeric, 30)
  ) AS x(name, price_delta, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_options o
    WHERE o.option_group_id = v_dimsum_group AND o.name = x.name
  );

  INSERT INTO public.menu_item_option_groups (item_id, option_group_id, sort_order)
  SELECT m.item_id, v_dimsum_group, 20
  FROM public.menu_items m
  WHERE m.shop_id = v_shop_id
    AND m.name = 'ขนมจีบกุ้ง'
  ON CONFLICT (item_id, option_group_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- 3) Bundle: choose exactly 4 buns, mixed fillings allowed
  -- ----------------------------------------------------------
  SELECT b.bundle_id
    INTO v_bundle_id
  FROM public.menu_bundles b
  WHERE b.shop_id = v_shop_id
    AND b.name = 'ชุดซาลาเปา 4 ลูก (TEST)'
  LIMIT 1;

  IF v_bundle_id IS NULL THEN
    INSERT INTO public.menu_bundles (
      shop_id, name, description, price, category,
      is_available, sort_order
    ) VALUES (
      v_shop_id,
      'ชุดซาลาเปา 4 ลูก (TEST)',
      'เลือกซาลาเปาไส้ครีมหรือหมูสับผสมกันให้ครบ 4 ลูก — สำหรับทดสอบ Ordering Flow v2',
      75,
      'ชุดทดสอบ',
      true,
      5
    )
    RETURNING bundle_id INTO v_bundle_id;
  END IF;

  SELECT bg.bundle_group_id
    INTO v_bundle_group_id
  FROM public.menu_bundle_groups bg
  WHERE bg.bundle_id = v_bundle_id
    AND bg.name = 'เลือกซาลาเปา 4 ลูก (TEST)'
  LIMIT 1;

  IF v_bundle_group_id IS NULL THEN
    INSERT INTO public.menu_bundle_groups (
      bundle_id, name, min_units, max_units, sort_order
    ) VALUES (
      v_bundle_id,
      'เลือกซาลาเปา 4 ลูก (TEST)',
      4, 4, 10
    )
    RETURNING bundle_group_id INTO v_bundle_group_id;
  END IF;

  INSERT INTO public.menu_bundle_group_items (
    bundle_group_id, item_id, price_delta, sort_order
  )
  SELECT
    v_bundle_group_id,
    m.item_id,
    0,
    CASE m.name WHEN 'ซาลาเปาไส้ครีม' THEN 10 ELSE 20 END
  FROM public.menu_items m
  WHERE m.shop_id = v_shop_id
    AND m.name IN ('ซาลาเปาไส้ครีม', 'ซาลาเปาหมูสับ')
  ON CONFLICT (bundle_group_id, item_id) DO NOTHING;

  -- Bundle-level required packaging option; one choice adds +10 baht.
  SELECT g.option_group_id
    INTO v_pack_group
  FROM public.menu_option_groups g
  WHERE g.shop_id = v_shop_id
    AND g.name = 'แพ็กเกจชุด (TEST)'
  LIMIT 1;

  IF v_pack_group IS NULL THEN
    INSERT INTO public.menu_option_groups (
      shop_id, name, description, min_select, max_select,
      is_required, is_active, sort_order
    ) VALUES (
      v_shop_id,
      'แพ็กเกจชุด (TEST)',
      'ทดสอบ option ระดับ bundle และราคาเพิ่ม',
      1, 1, true, true, 30
    )
    RETURNING option_group_id INTO v_pack_group;
  END IF;

  INSERT INTO public.menu_options (
    option_group_id, name, price_delta, is_default, is_active, sort_order
  )
  SELECT v_pack_group, x.name, x.price_delta, x.is_default, true, x.sort_order
  FROM (VALUES
    ('ถุงปกติ',        0::numeric, true, 10),
    ('กล่องของขวัญ',  10::numeric, false, 20)
  ) AS x(name, price_delta, is_default, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_options o
    WHERE o.option_group_id = v_pack_group AND o.name = x.name
  );

  INSERT INTO public.menu_bundle_option_groups (bundle_id, option_group_id, sort_order)
  VALUES (v_bundle_id, v_pack_group, 10)
  ON CONFLICT (bundle_id, option_group_id) DO NOTHING;

  RAISE NOTICE 'Ordering v2 TEST seed applied for shop_id=%', v_shop_id;
END
$$;
