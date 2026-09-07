-- Read-only parity/conflict report for the canonical Customize migration.
-- Run after the backfill rehearsal. This file performs no writes.

-- 1. Mapping and unresolved-conflict summary.
select
  legacy_entity_type,
  canonical_entity_type,
  count(*) as mapped_rows,
  count(*) filter (where mapping_reason = 'category_clone') as category_clones
from public.customize_canonical_migration_map
group by legacy_entity_type, canonical_entity_type
order by legacy_entity_type, canonical_entity_type;

select conflict_code, count(*) as open_conflicts
from public.customize_canonical_migration_conflicts
where blocking and resolved_at is null
group by conflict_code
order by conflict_code;

-- 2. Legacy-to-canonical row-count expectations.
select 'legacy_groups' as metric, count(*)::bigint as row_count from public.menu_option_groups
union all
select 'mapped_groups', count(*) from public.customize_canonical_migration_map where legacy_entity_type = 'group'
union all
select 'legacy_options', count(*) from public.menu_options
union all
select 'mapped_options', count(*) from public.customize_canonical_migration_map where legacy_entity_type = 'option'
union all
select 'legacy_assignments', count(*) from public.menu_item_option_groups
union all
select 'mapped_assignments', count(*) from public.customize_canonical_migration_map where legacy_entity_type = 'item_assignment'
union all
select 'canonical_assignments', count(*) from public.menu_item_customize_groups;

-- 3. Every legacy assignment must have a canonical assignment mapping.
select l.item_id, l.option_group_id, 'missing_assignment_mapping' as conflict
from public.menu_item_option_groups l
left join public.customize_canonical_migration_map m
  on m.legacy_entity_type = 'item_assignment'
 and m.legacy_key = l.item_id::text || ':' || l.option_group_id::text
where m.mapping_id is null;

-- 4. Assignment constraint parity. Each legacy group rule must equal the
-- effective canonical rule for every mapped item assignment.
select
  l.item_id,
  l.option_group_id,
  c.item_id as canonical_item_id,
  c.group_id as canonical_group_id,
  g.is_required as legacy_is_required,
  c.is_required as canonical_is_required,
  g.min_select as legacy_min_select,
  c.min_select as canonical_min_select,
  g.max_select as legacy_max_select,
  c.max_select as canonical_max_select
from public.menu_item_option_groups l
join public.menu_option_groups g on g.option_group_id = l.option_group_id
join public.customize_canonical_migration_map m
  on m.legacy_entity_type = 'item_assignment'
 and m.legacy_key = l.item_id::text || ':' || l.option_group_id::text
join public.menu_item_customize_groups c
  on c.item_id::text || ':' || c.group_id::text = m.canonical_key
where g.is_required <> c.is_required
   or g.min_select <> c.min_select
   or g.max_select <> c.max_select
   or l.sort_order <> c.sort_order;

-- 5. Option parity, including price and default state.
select
  o.option_id as legacy_option_id,
  m.canonical_id,
  o.name as legacy_name,
  c.label as canonical_label,
  o.price_delta as legacy_price_delta,
  c.price_delta as canonical_price_delta,
  o.is_default as legacy_is_default,
  c.is_default as canonical_is_default,
  o.is_active as legacy_is_active,
  c.is_active as canonical_is_active
from public.menu_options o
join public.customize_canonical_migration_map m
  on m.legacy_entity_type = 'option'
 and m.legacy_key = o.option_id::text
join public.shop_customize_options c on c.option_id = m.canonical_id
where o.name <> c.label
   or o.price_delta <> c.price_delta
   or o.is_default <> c.is_default
   or o.is_active <> c.is_active;

-- 6. Deterministic semantic checksums. IDs are intentionally excluded because
-- canonical IDs are newly generated and category clones are expected.
with option_rows as (
  select
    m.shop_id,
    m.legacy_key,
    m.clone_key,
    o.name,
    o.price_delta,
    o.is_default,
    o.is_active,
    c.label,
    c.price_delta as canonical_price_delta,
    c.is_default as canonical_is_default,
    c.is_active as canonical_is_active
  from public.customize_canonical_migration_map m
  join public.menu_options o on o.option_id::text = m.legacy_key
  join public.shop_customize_options c on c.option_id = m.canonical_id
  where m.legacy_entity_type = 'option'
)
select
  md5(coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', shop_id, legacy_key, clone_key, name, price_delta, is_default), '|' order by shop_id, legacy_key, clone_key), '')) as legacy_expanded_checksum,
  md5(coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', shop_id, legacy_key, clone_key, label, canonical_price_delta, canonical_is_default), '|' order by shop_id, legacy_key, clone_key), '')) as canonical_expanded_checksum,
  count(*) filter (where name <> label or price_delta <> canonical_price_delta or is_default <> canonical_is_default or is_active <> canonical_is_active) as semantic_mismatches
from option_rows;

with assignment_rows as (
  select
    m.shop_id,
    m.legacy_key,
    m.clone_key,
    g.is_required,
    g.min_select,
    g.max_select,
    l.sort_order,
    c.is_required as canonical_is_required,
    c.min_select as canonical_min_select,
    c.max_select as canonical_max_select,
    c.sort_order as canonical_sort_order
  from public.customize_canonical_migration_map m
  join public.menu_item_option_groups l
    on m.legacy_key = l.item_id::text || ':' || l.option_group_id::text
  join public.menu_option_groups g on g.option_group_id = l.option_group_id
  join public.menu_item_customize_groups c
    on c.item_id::text || ':' || c.group_id::text = m.canonical_key
  where m.legacy_entity_type = 'item_assignment'
)
select
  md5(coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', shop_id, legacy_key, clone_key, is_required, min_select, max_select), '|' order by shop_id, legacy_key, clone_key), '')) as legacy_assignment_checksum,
  md5(coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', shop_id, legacy_key, clone_key, canonical_is_required, canonical_min_select, canonical_max_select), '|' order by shop_id, legacy_key, clone_key), '')) as canonical_assignment_checksum,
  count(*) filter (where is_required <> canonical_is_required or min_select <> canonical_min_select or max_select <> canonical_max_select or sort_order <> canonical_sort_order) as assignment_mismatches
from assignment_rows;

-- 7. No-loss checks for legacy values that have no canonical equivalent.
select o.option_id, o.name, 'option_not_mapped' as issue
from public.menu_options o
where not exists (
  select 1 from public.customize_canonical_migration_map m
  where m.legacy_entity_type = 'option' and m.legacy_key = o.option_id::text
)
union all
select g.option_group_id, g.name, 'group_not_mapped'
from public.menu_option_groups g
where not exists (
  select 1 from public.customize_canonical_migration_map m
  where m.legacy_entity_type = 'group' and m.legacy_key = g.option_group_id::text
);
