-- MyTree Ordering Flow v2 — repair TEST seed text after Windows clipboard encoding damage.
-- ASCII-only migration: all Thai strings use PostgreSQL Unicode escape literals.
-- Safe to run once after 20260811110000_ordering_v2_test_seed.sql.

DO $$
DECLARE
  v_shop_id text;
  v_bundle_id uuid;
  v_bundle_group_id uuid;
  v_heat_group uuid;
  v_dimsum_group uuid;
  v_pack_group uuid;
BEGIN
  SELECT s.shop_id
    INTO v_shop_id
  FROM public.shops s
  WHERE s.name ILIKE '%SonBaoBao%'
  ORDER BY s.created_at NULLS LAST
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE NOTICE 'Ordering v2 encoding repair skipped: SonBaoBao shop not found';
    RETURN;
  END IF;

  -- Bundle can be found reliably by the ASCII marker left in its description.
  SELECT b.bundle_id
    INTO v_bundle_id
  FROM public.menu_bundles b
  WHERE b.shop_id = v_shop_id
    AND (b.description ILIKE '%Ordering Flow v2%' OR (b.price = 75 AND b.sort_order = 5))
  ORDER BY b.created_at DESC
  LIMIT 1;

  IF v_bundle_id IS NOT NULL THEN
    UPDATE public.menu_bundles
       SET name = U&'\0E0A\0E38\0E14\0E0B\0E32\0E25\0E32\0E40\0E1B\0E32 4 \0E25\0E39\0E01 (TEST)',
           description = U&'\0E40\0E25\0E37\0E2D\0E01\0E0B\0E32\0E25\0E32\0E40\0E1B\0E32\0E44\0E2A\0E49\0E04\0E23\0E35\0E21\0E2B\0E23\0E37\0E2D\0E2B\0E21\0E39\0E2A\0E31\0E1A\0E1C\0E2A\0E21\0E01\0E31\0E19\0E43\0E2B\0E49\0E04\0E23\0E1A 4 \0E25\0E39\0E01 \2014 \0E2A\0E33\0E2B\0E23\0E31\0E1A\0E17\0E14\0E2A\0E2D\0E1A Ordering Flow v2',
           category = U&'\0E0A\0E38\0E14\0E17\0E14\0E2A\0E2D\0E1A'
     WHERE bundle_id = v_bundle_id;

    SELECT bg.bundle_group_id
      INTO v_bundle_group_id
    FROM public.menu_bundle_groups bg
    WHERE bg.bundle_id = v_bundle_id
    ORDER BY bg.sort_order, bg.created_at
    LIMIT 1;

    IF v_bundle_group_id IS NOT NULL THEN
      UPDATE public.menu_bundle_groups
         SET name = U&'\0E40\0E25\0E37\0E2D\0E01\0E0B\0E32\0E25\0E32\0E40\0E1B\0E32 4 \0E25\0E39\0E01 (TEST)'
       WHERE bundle_group_id = v_bundle_group_id;
    END IF;
  END IF;

  SELECT g.option_group_id INTO v_heat_group
  FROM public.menu_option_groups g
  WHERE g.shop_id = v_shop_id AND g.sort_order = 10 AND g.name LIKE '%(TEST)%'
  ORDER BY g.created_at DESC LIMIT 1;

  IF v_heat_group IS NOT NULL THEN
    UPDATE public.menu_option_groups
       SET name = U&'\0E01\0E32\0E23\0E2D\0E38\0E48\0E19 (TEST)',
           description = U&'\0E02\0E49\0E2D\0E21\0E39\0E25\0E15\0E31\0E27\0E2D\0E22\0E48\0E32\0E07\0E2A\0E33\0E2B\0E23\0E31\0E1A\0E17\0E14\0E2A\0E2D\0E1A\0E15\0E31\0E27\0E40\0E25\0E37\0E2D\0E01\0E41\0E1A\0E1A\0E1A\0E31\0E07\0E04\0E31\0E1A\0E40\0E25\0E37\0E2D\0E01 1 \0E23\0E32\0E22\0E01\0E32\0E23'
     WHERE option_group_id = v_heat_group;

    UPDATE public.menu_options SET name = U&'\0E2D\0E38\0E48\0E19\0E1E\0E23\0E49\0E2D\0E21\0E17\0E32\0E19'
     WHERE option_group_id = v_heat_group AND sort_order = 10;
    UPDATE public.menu_options SET name = U&'\0E44\0E21\0E48\0E2D\0E38\0E48\0E19'
     WHERE option_group_id = v_heat_group AND sort_order = 20;
    UPDATE public.menu_options SET name = U&'\0E23\0E31\0E1A\0E41\0E1A\0E1A\0E40\0E22\0E47\0E19'
     WHERE option_group_id = v_heat_group AND sort_order = 30;
  END IF;

  SELECT g.option_group_id INTO v_dimsum_group
  FROM public.menu_option_groups g
  WHERE g.shop_id = v_shop_id AND g.sort_order = 20 AND g.name LIKE '%(TEST)%'
  ORDER BY g.created_at DESC LIMIT 1;

  IF v_dimsum_group IS NOT NULL THEN
    UPDATE public.menu_option_groups
       SET name = U&'\0E02\0E2D\0E07\0E40\0E1E\0E34\0E48\0E21\0E2A\0E33\0E2B\0E23\0E31\0E1A\0E02\0E19\0E21\0E08\0E35\0E1A (TEST)',
           description = U&'\0E02\0E49\0E2D\0E21\0E39\0E25\0E15\0E31\0E27\0E2D\0E22\0E48\0E32\0E07\0E2A\0E33\0E2B\0E23\0E31\0E1A\0E17\0E14\0E2A\0E2D\0E1A multi-select \0E41\0E25\0E30\0E23\0E32\0E04\0E32\0E40\0E1E\0E34\0E48\0E21'
     WHERE option_group_id = v_dimsum_group;

    UPDATE public.menu_options SET name = U&'\0E40\0E1E\0E34\0E48\0E21\0E19\0E49\0E33\0E08\0E34\0E49\0E21'
     WHERE option_group_id = v_dimsum_group AND sort_order = 10;
    UPDATE public.menu_options SET name = U&'\0E40\0E1E\0E34\0E48\0E21\0E01\0E23\0E30\0E40\0E17\0E35\0E22\0E21\0E40\0E08\0E35\0E22\0E27'
     WHERE option_group_id = v_dimsum_group AND sort_order = 20;
    UPDATE public.menu_options SET name = U&'\0E40\0E1E\0E34\0E48\0E21\0E1E\0E23\0E34\0E01'
     WHERE option_group_id = v_dimsum_group AND sort_order = 30;
  END IF;

  SELECT g.option_group_id INTO v_pack_group
  FROM public.menu_option_groups g
  WHERE g.shop_id = v_shop_id AND g.sort_order = 30 AND g.name LIKE '%(TEST)%'
  ORDER BY g.created_at DESC LIMIT 1;

  IF v_pack_group IS NOT NULL THEN
    UPDATE public.menu_option_groups
       SET name = U&'\0E41\0E1E\0E47\0E01\0E40\0E01\0E08\0E0A\0E38\0E14 (TEST)',
           description = U&'\0E17\0E14\0E2A\0E2D\0E1A option \0E23\0E30\0E14\0E31\0E1A bundle \0E41\0E25\0E30\0E23\0E32\0E04\0E32\0E40\0E1E\0E34\0E48\0E21'
     WHERE option_group_id = v_pack_group;

    UPDATE public.menu_options SET name = U&'\0E16\0E38\0E07\0E1B\0E01\0E15\0E34'
     WHERE option_group_id = v_pack_group AND sort_order = 10;
    UPDATE public.menu_options SET name = U&'\0E01\0E25\0E48\0E2D\0E07\0E02\0E2D\0E07\0E02\0E27\0E31\0E0D'
     WHERE option_group_id = v_pack_group AND sort_order = 20;
  END IF;

  RAISE NOTICE 'Ordering v2 TEST unicode text repaired for shop_id=%', v_shop_id;
END
$$;
