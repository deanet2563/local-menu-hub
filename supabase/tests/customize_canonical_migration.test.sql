-- Draft post-backfill assertions.
-- Execute only against a local/staging database after the rehearsal backfill.
-- The assertions are read-only and can be wrapped in a transaction.

\set ON_ERROR_STOP on
begin;

do $$
declare
  bad_count integer;
begin
  -- Canonical UUIDs must not be inferred from legacy UUIDs.
  select count(*) into bad_count
  from public.customize_canonical_migration_map m
  where m.canonical_id is not null
    and m.legacy_key = m.canonical_id::text;
  if bad_count > 0 then
    raise exception 'ID mapping test failed: % canonical IDs equal legacy IDs', bad_count;
  end if;

  -- Every legacy group and option must have at least one mapping.
  select count(*) into bad_count
  from public.menu_option_groups g
  where not exists (
    select 1 from public.customize_canonical_migration_map m
    where m.legacy_entity_type = 'group'
      and m.legacy_key = g.option_group_id::text
  );
  if bad_count > 0 then
    raise exception 'no-loss group mapping test failed: % groups missing', bad_count;
  end if;

  select count(*) into bad_count
  from public.menu_options o
  where not exists (
    select 1 from public.customize_canonical_migration_map m
    where m.legacy_entity_type = 'option'
      and m.legacy_key = o.option_id::text
  );
  if bad_count > 0 then
    raise exception 'no-loss option mapping test failed: % options missing', bad_count;
  end if;

  -- All canonical assignments must obey the database rule shape.
  select count(*) into bad_count
  from public.menu_item_customize_groups a
  where a.min_select < 0
     or a.max_select < 1
     or a.min_select > a.max_select
     or (a.is_required and a.min_select < 1);
  if bad_count > 0 then
    raise exception 'assignment constraint test failed: % invalid rows', bad_count;
  end if;

  -- Legacy default state must equal canonical default state for every option clone.
  select count(*) into bad_count
  from public.customize_canonical_migration_map m
  join public.menu_options legacy on legacy.option_id::text = m.legacy_key
  join public.shop_customize_options canonical on canonical.option_id = m.canonical_id
  where m.legacy_entity_type = 'option'
    and legacy.is_default <> canonical.is_default;
  if bad_count > 0 then
    raise exception 'default option test failed: % mismatches', bad_count;
  end if;

  -- Each category-spanning legacy group must produce one mapping per category.
  select count(*) into bad_count
  from (
    select l.legacy_group_id
    from (
      select legacy_key::uuid as legacy_group_id, count(distinct clone_key) as clone_count
      from public.customize_canonical_migration_map
      where legacy_entity_type = 'group'
        and mapping_reason = 'category_clone'
      group by legacy_key
    ) l
    where l.clone_count < 2
  ) broken;
  if bad_count > 0 then
    raise exception 'category clone test failed: % groups have incomplete clones', bad_count;
  end if;

  if exists (
    select 1 from public.customize_canonical_migration_conflicts
    where blocking and resolved_at is null
  ) then
    raise exception 'conflict test failed: unresolved blocking conflicts remain';
  end if;
end $$;

rollback;
