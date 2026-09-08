do $$
declare
  required_table text;
  missing text[] := '{}';
begin
  foreach required_table in array array[
    'shops',
    'menu_items',
    'customers',
    'hub_orders',
    'sub_orders',
    'order_items',
    'delivery_candidate_interests',
    'shop_menu_categories',
    'shop_customize_groups',
    'shop_customize_options',
    'menu_item_customize_groups'
  ] loop
    if to_regclass('public.' || required_table) is null then
      missing := array_append(missing, required_table);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'local bootstrap missing required tables: %', array_to_string(missing, ', ');
  end if;

  if to_regprocedure('public.fn_rider_nearby_delivery_jobs(numeric)') is null then
    raise exception 'local bootstrap missing fn_rider_nearby_delivery_jobs(numeric)';
  end if;

  if to_regprocedure('public.fn_rider_nearby_delivery_jobs_v2(numeric)') is null then
    raise exception 'local bootstrap missing fn_rider_nearby_delivery_jobs_v2(numeric)';
  end if;
end;
$$;
