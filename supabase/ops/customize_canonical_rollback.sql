-- Draft rollback for a canonical Customize backfill rehearsal.
-- Run only on local/staging after checking the preflight. Never run against
-- production without explicit approval and a database backup.

\set ON_ERROR_STOP on
begin;

-- Refuse rollback if canonical rows changed after the backfill. This prevents
-- deleting merchant edits made after migration.
do $$
begin
  if exists (
    select 1
    from public.customize_canonical_migration_map m
    join public.shop_customize_options o
      on m.canonical_entity_type = 'option'
     and o.option_id = m.canonical_id
    where md5(row(o.label, o.price_delta, o.is_default, o.is_active, o.sort_order)::text)
          <> split_part(m.canonical_fingerprint, ':', 1)
  ) then
    raise exception 'rollback refused: canonical option rows changed after backfill';
  end if;
end $$;

-- Delete only rows recorded by the migration map, in dependency order.
delete from public.menu_item_customize_groups a
where exists (
  select 1
  from public.customize_canonical_migration_map m
  where m.canonical_entity_type = 'item_assignment'
    and m.canonical_created
    and m.canonical_key = a.item_id::text || ':' || a.group_id::text
);

delete from public.shop_customize_options o
where exists (
  select 1
  from public.customize_canonical_migration_map m
  where m.canonical_entity_type = 'option'
    and m.canonical_created
    and m.canonical_id = o.option_id
);

delete from public.shop_customize_groups g
where exists (
  select 1
  from public.customize_canonical_migration_map m
  where m.canonical_entity_type = 'group'
    and m.canonical_created
    and m.canonical_id = g.group_id
);

update public.menu_items i
set category_id = null
where exists (
  select 1
  from public.customize_canonical_migration_map m
  where m.canonical_entity_type = 'category'
    and m.canonical_id = i.category_id
);

delete from public.shop_menu_categories c
where exists (
  select 1
  from public.customize_canonical_migration_map m
  where m.canonical_entity_type = 'category'
    and m.canonical_id = c.category_id
    and m.canonical_created
);

delete from public.customize_canonical_migration_map;
delete from public.customize_canonical_migration_conflicts;

-- Rollback rehearsal is intentionally non-destructive by default.
rollback;
