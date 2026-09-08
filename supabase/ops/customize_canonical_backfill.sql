-- Draft backfill rehearsal for the canonical Customize model.
-- Run only on a local/staging clone inside an explicit transaction.
-- This file intentionally ends with ROLLBACK. Change only after approval.

\set ON_ERROR_STOP on
begin;

-- 0. Refuse to proceed when legacy links cross shop ownership boundaries.
insert into public.customize_canonical_migration_conflicts (
  shop_id, entity_type, legacy_key, conflict_code, details
)
select
  i.shop_id,
  'item_assignment',
  i.item_id::text || ':' || l.option_group_id::text,
  'legacy_group_shop_mismatch',
  jsonb_build_object(
    'item_shop_id', i.shop_id,
    'group_shop_id', g.shop_id,
    'item_id', i.item_id,
    'option_group_id', l.option_group_id
  )
from public.menu_item_option_groups l
join public.menu_items i on i.item_id = l.item_id
join public.menu_option_groups g on g.option_group_id = l.option_group_id
where i.shop_id <> g.shop_id
on conflict (entity_type, legacy_key, conflict_code) do update
set details = excluded.details, resolved_at = null;

-- Case/whitespace-normalized canonical category lookup must be unambiguous.
-- Block duplicate pre-existing rows instead of choosing one nondeterministically.
insert into public.customize_canonical_migration_conflicts (
  shop_id, entity_type, legacy_key, conflict_code, details
)
select
  m.shop_id,
  'category_text',
  coalesce(nullif(lower(trim(m.category)), ''), '__uncategorized__'),
  'canonical_category_ambiguous',
  jsonb_build_object(
    'normalized_name', coalesce(nullif(lower(trim(m.category)), ''), '__uncategorized__'),
    'canonical_category_ids', jsonb_agg(c.category_id order by c.category_id)
  )
from public.menu_items m
join public.shop_menu_categories c
  on c.shop_id = m.shop_id
 and lower(trim(c.name)) = lower(trim(coalesce(nullif(trim(m.category), ''), 'ทั่วไป')))
where m.shop_id is not null
group by m.shop_id, coalesce(nullif(lower(trim(m.category)), ''), '__uncategorized__')
having count(distinct c.category_id) > 1
on conflict (entity_type, legacy_key, conflict_code) do update
set details = excluded.details, resolved_at = null;

-- 1. Build category plans from the legacy text category. The fallback category
-- preserves rows with no category instead of silently dropping them.
create temp table _canonical_category_plan (
  shop_id text not null,
  legacy_key text not null,
  category_name text not null,
  canonical_id uuid not null default gen_random_uuid(),
  canonical_created boolean not null default true,
  primary key (shop_id, legacy_key)
) on commit drop;

insert into _canonical_category_plan (shop_id, legacy_key, category_name)
select
  m.shop_id,
  coalesce(nullif(lower(trim(m.category)), ''), '__uncategorized__'),
  coalesce(min(nullif(trim(m.category), '')), 'ทั่วไป')
from public.menu_items m
where m.shop_id is not null
group by m.shop_id, coalesce(nullif(lower(trim(m.category)), ''), '__uncategorized__');

-- Reuse an existing canonical category only by its verified shop/name key,
-- never by assuming that legacy and canonical IDs match.
update _canonical_category_plan p
set canonical_id = c.category_id
from public.shop_menu_categories c
where c.shop_id = p.shop_id
  and lower(trim(c.name)) = lower(trim(p.category_name));

update _canonical_category_plan p
set canonical_created = false
where exists (
  select 1 from public.shop_menu_categories c
  where c.category_id = p.canonical_id
);

-- A canonical row with the same semantic key must be reconciled explicitly;
-- never allow a generated group insert to fail on a unique-name constraint.
insert into public.customize_canonical_migration_conflicts (
  shop_id, entity_type, legacy_key, conflict_code, details
)
select distinct
  g.shop_id,
  'group',
  g.option_group_id::text,
  'canonical_group_semantic_collision',
  jsonb_build_object(
    'category_id', p.canonical_id,
    'section_name', c.name,
    'group_name', g.name,
    'canonical_group_id', x.group_id
  )
from public.menu_option_groups g
join public.menu_item_option_groups l on l.option_group_id = g.option_group_id
join public.menu_items i on i.item_id = l.item_id and i.shop_id = g.shop_id
join _canonical_category_plan p
  on p.shop_id = i.shop_id
 and p.legacy_key = coalesce(nullif(lower(trim(i.category)), ''), '__uncategorized__')
join public.shop_menu_categories c on c.category_id = p.canonical_id
join public.shop_customize_groups x
  on x.shop_id = g.shop_id
 and x.category_id = p.canonical_id
 and x.section_name = c.name
 and x.name = g.name
on conflict (entity_type, legacy_key, conflict_code) do update
set details = excluded.details, resolved_at = null;

do $$
declare
  conflict_count integer;
  conflict_codes text;
begin
  select count(*), string_agg(distinct conflict_code, ', ' order by conflict_code)
    into conflict_count, conflict_codes
  from public.customize_canonical_migration_conflicts
  where blocking and resolved_at is null;
  if conflict_count > 0 then
    raise exception 'canonical Customize backfill blocked by % unresolved conflicts (%): %', conflict_count, conflict_codes, 'resolve conflict rows before backfill';
  end if;
end $$;

insert into public.shop_menu_categories (category_id, shop_id, name, sort_order, is_active)
select
  p.canonical_id,
  p.shop_id,
  p.category_name,
  row_number() over (partition by p.shop_id order by p.category_name) - 1,
  true
from _canonical_category_plan p
where not exists (
  select 1 from public.shop_menu_categories c
  where c.category_id = p.canonical_id
);

update public.menu_items m
set category_id = p.canonical_id
from _canonical_category_plan p
where p.shop_id = m.shop_id
  and p.legacy_key = coalesce(nullif(lower(trim(m.category)), ''), '__uncategorized__');

insert into public.customize_canonical_migration_map (
  shop_id, canonical_created, legacy_entity_type, legacy_key,
  canonical_entity_type, canonical_key, canonical_id,
  clone_key, mapping_reason, legacy_fingerprint, canonical_fingerprint
)
select
  p.shop_id,
  p.canonical_created,
  'category_text',
  p.legacy_key,
  'category',
  p.canonical_id::text,
  p.canonical_id,
  null,
  case when p.legacy_key = '__uncategorized__' then 'uncategorized' else 'direct' end,
  md5(p.shop_id || ':' || p.legacy_key || ':' || p.category_name),
  md5(p.shop_id || ':' || p.canonical_id::text || ':' || p.category_name)
from _canonical_category_plan p
on conflict (legacy_entity_type, legacy_key, canonical_entity_type, clone_key) do nothing;

-- 2. Each legacy group is planned once per category. A group spanning multiple
-- categories becomes deterministic category clones, recorded by clone_key.
create temp table _canonical_group_plan (
  shop_id text not null,
  legacy_group_id uuid not null,
  category_id uuid not null,
  canonical_id uuid not null default gen_random_uuid(),
  category_clone boolean not null,
  primary key (legacy_group_id, category_id)
) on commit drop;

insert into _canonical_group_plan (shop_id, legacy_group_id, category_id, category_clone)
select distinct
  g.shop_id,
  g.option_group_id,
  m.category_id,
  count(*) over (partition by g.option_group_id) > 1
from public.menu_option_groups g
join public.menu_item_option_groups l on l.option_group_id = g.option_group_id
join public.menu_items m on m.item_id = l.item_id and m.shop_id = g.shop_id
where m.category_id is not null
  and not exists (
    select 1 from public.customize_canonical_migration_conflicts c
    where c.entity_type = 'item_assignment'
      and c.legacy_key = m.item_id::text || ':' || l.option_group_id::text
      and c.conflict_code = 'legacy_group_shop_mismatch'
      and c.resolved_at is null
  );

insert into _canonical_group_plan (shop_id, legacy_group_id, category_id, category_clone)
select g.shop_id, g.option_group_id, c.canonical_id, false
from public.menu_option_groups g
join _canonical_category_plan c on c.shop_id = g.shop_id and c.legacy_key = '__uncategorized__'
where not exists (
  select 1 from _canonical_group_plan p where p.legacy_group_id = g.option_group_id
)
and exists (select 1 from public.menu_options o where o.option_group_id = g.option_group_id);

-- Re-runs reuse only previously recorded mappings. New rows always receive a
-- generated canonical ID; no legacy UUID equality is assumed.
update _canonical_group_plan p
set canonical_id = m.canonical_id
from public.customize_canonical_migration_map m
where m.legacy_entity_type = 'group'
  and m.legacy_key = p.legacy_group_id::text
  and m.canonical_entity_type = 'group'
  and m.clone_key = p.category_id::text;

insert into public.shop_customize_groups (
  group_id, shop_id, category_id, section_name, name, description, sort_order, is_active
)
select
  p.canonical_id,
  g.shop_id,
  p.category_id,
  c.name,
  g.name,
  g.description,
  g.sort_order,
  g.is_active
from _canonical_group_plan p
join public.menu_option_groups g on g.option_group_id = p.legacy_group_id
join public.shop_menu_categories c on c.category_id = p.category_id
where not exists (
  select 1 from public.shop_customize_groups x where x.group_id = p.canonical_id
);

insert into public.customize_canonical_migration_map (
  shop_id, canonical_created, legacy_entity_type, legacy_key,
  canonical_entity_type, canonical_key, canonical_id,
  clone_key, mapping_reason, legacy_fingerprint, canonical_fingerprint
)
select
  g.shop_id,
  true,
  'group',
  g.option_group_id::text,
  'group',
  p.canonical_id::text,
  p.canonical_id,
  p.category_id::text,
  case when p.category_clone then 'category_clone' else 'direct' end,
  md5(row(g.name, g.description, g.is_active, g.sort_order)::text),
  md5(row(g.name, g.description, g.is_active, g.sort_order)::text)
from _canonical_group_plan p
join public.menu_option_groups g on g.option_group_id = p.legacy_group_id
on conflict (legacy_entity_type, legacy_key, canonical_entity_type, clone_key) do nothing;

-- 3. Clone options for every canonical group clone and preserve defaults.
create temp table _canonical_option_plan (
  legacy_option_id uuid not null,
  canonical_group_id uuid not null,
  canonical_id uuid not null default gen_random_uuid(),
  primary key (legacy_option_id, canonical_group_id)
) on commit drop;

insert into _canonical_option_plan (legacy_option_id, canonical_group_id)
select o.option_id, p.canonical_id
from public.menu_options o
join _canonical_group_plan p on p.legacy_group_id = o.option_group_id;

update _canonical_option_plan p
set canonical_id = m.canonical_id
from public.customize_canonical_migration_map m
where m.legacy_entity_type = 'option'
  and m.legacy_key = p.legacy_option_id::text
  and m.canonical_entity_type = 'option'
  and m.clone_key = p.canonical_group_id::text;

insert into public.shop_customize_options (
  option_id, group_id, label, price_delta, is_default, sort_order, is_active
)
select
  p.canonical_id,
  p.canonical_group_id,
  o.name,
  o.price_delta,
  o.is_default,
  o.sort_order,
  o.is_active
from _canonical_option_plan p
join public.menu_options o on o.option_id = p.legacy_option_id
where not exists (
  select 1 from public.shop_customize_options x where x.option_id = p.canonical_id
);

insert into public.customize_canonical_migration_map (
  shop_id, canonical_created, legacy_entity_type, legacy_key,
  canonical_entity_type, canonical_key, canonical_id,
  clone_key, mapping_reason, legacy_fingerprint, canonical_fingerprint
)
select
  g.shop_id,
  true,
  'option',
  o.option_id::text,
  'option',
  p.canonical_id::text,
  p.canonical_id,
  p.canonical_group_id::text,
  case when gp.category_clone then 'category_clone' else 'direct' end,
  md5(row(o.name, o.price_delta, o.is_default, o.is_active, o.sort_order)::text),
  md5(row(o.name, o.price_delta, o.is_default, o.is_active, o.sort_order)::text)
from _canonical_option_plan p
join public.menu_options o on o.option_id = p.legacy_option_id
join public.shop_customize_groups g on g.group_id = p.canonical_group_id
join _canonical_group_plan gp on gp.canonical_id = p.canonical_group_id
on conflict (legacy_entity_type, legacy_key, canonical_entity_type, clone_key) do nothing;

-- 4. Copy assignment constraints from the legacy group to each item assignment.
insert into public.menu_item_customize_groups (
  item_id, group_id, is_required, min_select, max_select, sort_order
)
select
  l.item_id,
  gp.canonical_id,
  g.is_required,
  g.min_select,
  g.max_select,
  l.sort_order
from public.menu_item_option_groups l
join public.menu_option_groups g on g.option_group_id = l.option_group_id
join public.menu_items i on i.item_id = l.item_id and i.shop_id = g.shop_id
join _canonical_group_plan gp
  on gp.legacy_group_id = l.option_group_id
 and gp.category_id = i.category_id
where not exists (
  select 1
  from public.menu_item_customize_groups x
  where x.item_id = l.item_id and x.group_id = gp.canonical_id
);

insert into public.customize_canonical_migration_map (
  shop_id, canonical_created, legacy_entity_type, legacy_key,
  canonical_entity_type, canonical_key, canonical_id,
  clone_key, mapping_reason, legacy_fingerprint, canonical_fingerprint
)
select
  i.shop_id,
  true,
  'item_assignment',
  l.item_id::text || ':' || l.option_group_id::text,
  'item_assignment',
  l.item_id::text || ':' || gp.canonical_id::text,
  null,
  gp.category_id::text,
  case when gp.category_clone then 'category_clone' else 'direct' end,
  md5(row(g.is_required, g.min_select, g.max_select, l.sort_order)::text),
  md5(row(g.is_required, g.min_select, g.max_select, l.sort_order)::text)
from public.menu_item_option_groups l
join public.menu_option_groups g on g.option_group_id = l.option_group_id
join public.menu_items i on i.item_id = l.item_id and i.shop_id = g.shop_id
join _canonical_group_plan gp
  on gp.legacy_group_id = l.option_group_id
 and gp.category_id = i.category_id
on conflict (legacy_entity_type, legacy_key, canonical_entity_type, clone_key) do nothing;

-- 5. Stop the rehearsal if any blocking conflict or mapping count anomaly exists.
do $$
declare
  conflict_count integer;
begin
  select count(*) into conflict_count
  from public.customize_canonical_migration_conflicts
  where blocking and resolved_at is null;
  if conflict_count > 0 then
    raise exception 'canonical Customize backfill blocked by % unresolved conflicts', conflict_count;
  end if;
end $$;

-- This is intentionally a rehearsal. Do not change to COMMIT without approval.
rollback;
