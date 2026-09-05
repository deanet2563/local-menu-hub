-- MyTree Shop: customize groups depend on real product categories.
-- Additive migration for merchant setup flow compatibility.
-- Production compatibility: shops.shop_id is text and fn_staff_shop_ids() returns SETOF text.

alter table public.shop_customize_groups
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shop_menu_categories_category_shop_unique'
      and conrelid = 'public.shop_menu_categories'::regclass
  ) then
    alter table public.shop_menu_categories
      add constraint shop_menu_categories_category_shop_unique unique (category_id, shop_id);
  end if;
end $$;

update public.shop_customize_groups g
   set category_id = c.category_id
  from public.shop_menu_categories c
 where g.category_id is null
   and c.shop_id = g.shop_id
   and lower(trim(c.name)) = lower(trim(g.section_name));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shop_customize_groups_category_shop_fk'
      and conrelid = 'public.shop_customize_groups'::regclass
  ) then
    alter table public.shop_customize_groups
      add constraint shop_customize_groups_category_shop_fk
      foreign key (category_id, shop_id)
      references public.shop_menu_categories(category_id, shop_id)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_shop_customize_groups_category
  on public.shop_customize_groups(shop_id, category_id, sort_order);

create or replace function public.fn_create_shop_customize_group_with_options(
  p_shop_id text,
  p_category_id uuid,
  p_name text,
  p_option_labels text[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_group_id uuid;
  v_category_name text;
  v_label text;
  v_clean_label text;
  v_seen_labels text[] := '{}';
  v_sort_order integer := 0;
begin
  if p_shop_id is null or not (p_shop_id in (select public.fn_staff_shop_ids())) then
    raise exception 'not_authorized_for_shop';
  end if;

  select c.name
    into v_category_name
  from public.shop_menu_categories c
  where c.shop_id = p_shop_id
    and c.category_id = p_category_id
    and c.is_active = true;

  if v_category_name is null then
    raise exception 'category_not_found_for_shop';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'customize_group_name_required';
  end if;

  if p_option_labels is null or array_length(p_option_labels, 1) is null then
    raise exception 'customize_options_required';
  end if;

  foreach v_label in array p_option_labels loop
    v_clean_label := nullif(trim(v_label), '');
    if v_clean_label is not null then
      if lower(v_clean_label) = any(v_seen_labels) then
        raise exception 'duplicate_customize_option_label';
      end if;
      v_seen_labels := array_append(v_seen_labels, lower(v_clean_label));
    end if;
  end loop;

  if array_length(v_seen_labels, 1) is null then
    raise exception 'customize_options_required';
  end if;

  insert into public.shop_customize_groups (
    shop_id,
    category_id,
    section_name,
    name,
    is_active
  ) values (
    p_shop_id,
    p_category_id,
    v_category_name,
    trim(p_name),
    true
  )
  returning group_id into v_group_id;

  foreach v_label in array p_option_labels loop
    v_clean_label := nullif(trim(v_label), '');
    if v_clean_label is not null then
      insert into public.shop_customize_options (
        group_id,
        label,
        price_delta,
        sort_order,
        is_active
      ) values (
        v_group_id,
        v_clean_label,
        0,
        v_sort_order,
        true
      );
      v_sort_order := v_sort_order + 1;
    end if;
  end loop;

  return v_group_id;
end;
$function$;

revoke all on function public.fn_create_shop_customize_group_with_options(text, uuid, text, text[]) from public;
revoke execute on function public.fn_create_shop_customize_group_with_options(text, uuid, text, text[]) from anon;
grant execute on function public.fn_create_shop_customize_group_with_options(text, uuid, text, text[]) to authenticated;

comment on function public.fn_create_shop_customize_group_with_options(text, uuid, text, text[]) is
  'Creates one category-scoped shop customize group and its options in a single staff-authorized transaction.';
