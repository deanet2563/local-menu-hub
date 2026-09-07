-- Draft only: canonical Customize migration preparation.
-- This migration is additive and intentionally does not backfill or remove data.
-- Apply only after local/staging rehearsal and explicit production approval.

alter table public.shop_customize_groups
  add column if not exists description text;

alter table public.shop_customize_options
  add column if not exists is_default boolean not null default false;

alter table public.menu_items
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_items_category_shop_fk'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_category_shop_fk
      foreign key (category_id, shop_id)
      references public.shop_menu_categories(category_id, shop_id)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_menu_items_shop_category
  on public.menu_items(shop_id, category_id, is_available);

comment on column public.shop_customize_groups.description is
  'Canonical optional description retained from legacy menu_option_groups.description.';

comment on column public.shop_customize_options.is_default is
  'Canonical default selection state retained from legacy menu_options.is_default.';

comment on column public.menu_items.category_id is
  'Canonical category ownership. Legacy menu_items.category remains during transition.';

create table if not exists public.customize_canonical_migration_map (
  mapping_id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(shop_id) on delete cascade,
  legacy_entity_type text not null check (legacy_entity_type in (
    'category_text', 'group', 'option', 'item_assignment'
  )),
  legacy_key text not null,
  canonical_entity_type text not null check (canonical_entity_type in (
    'category', 'group', 'option', 'item_assignment'
  )),
  canonical_key text not null,
  canonical_id uuid,
  clone_key text,
  mapping_reason text not null check (mapping_reason in (
    'direct', 'category_clone', 'uncategorized', 'orphan_group'
  )),
  legacy_fingerprint text not null,
  canonical_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (legacy_entity_type, legacy_key, canonical_entity_type, clone_key),
  unique (canonical_entity_type, canonical_key)
);

create index if not exists idx_customize_canonical_map_shop
  on public.customize_canonical_migration_map(shop_id, canonical_entity_type);

create table if not exists public.customize_canonical_migration_conflicts (
  conflict_id uuid primary key default gen_random_uuid(),
  shop_id text references public.shops(shop_id) on delete cascade,
  entity_type text not null,
  legacy_key text not null,
  conflict_code text not null,
  details jsonb not null default '{}'::jsonb,
  blocking boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (entity_type, legacy_key, conflict_code)
);

create index if not exists idx_customize_canonical_conflicts_open
  on public.customize_canonical_migration_conflicts(blocking, resolved_at);

alter table public.customize_canonical_migration_map enable row level security;
alter table public.customize_canonical_migration_conflicts enable row level security;

revoke all on table public.customize_canonical_migration_map from anon, authenticated;
revoke all on table public.customize_canonical_migration_conflicts from anon, authenticated;

comment on table public.customize_canonical_migration_map is
  'Audit map for newly generated canonical Customize/category IDs. Never infer ID equivalence.';

comment on table public.customize_canonical_migration_conflicts is
  'Blocking ownership, category, and data-shape conflicts found before canonical backfill.';

-- No public or merchant policies are granted for migration audit tables.
-- Access remains restricted to service_role/postgres until the migration is complete.
