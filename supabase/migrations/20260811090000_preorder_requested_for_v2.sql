-- MyTree Ordering Flow v2 — structured pre-order requested time
-- Additive to the live order schema. Existing [MYTREE_PREORDER] notes remain readable.

alter table public.sub_orders
  add column if not exists requested_for timestamptz;

create index if not exists idx_sub_orders_requested_for
  on public.sub_orders(shop_id, requested_for)
  where requested_for is not null;

-- The previous v2 wrapper has not been used by production yet. Replace its
-- signature so requested_for is persisted atomically with the order snapshots.
drop function if exists public.fn_create_order_v2(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, uuid, text, text
);

create function public.fn_create_order_v2(
  p_shop_id text,
  p_items jsonb,
  p_line_configurations jsonb,
  p_customer_id uuid default null,
  p_fulfillment_type fulfillment_type_enum default 'pickup',
  p_payment_method payment_method_enum default 'qr_transfer',
  p_delivery_address text default null,
  p_requested_for timestamptz default null,
  p_hub_order_id uuid default null,
  p_source text default 'liff_checkout',
  p_note text default null
)
returns table(out_hub_order_id uuid, out_sub_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hub_order_id uuid;
  v_sub_id uuid;
  v_config jsonb;
begin
  select f.out_hub_order_id, f.out_sub_id
    into v_hub_order_id, v_sub_id
  from public.fn_create_order(
    p_shop_id => p_shop_id,
    p_items => p_items,
    p_customer_id => p_customer_id,
    p_fulfillment_type => p_fulfillment_type,
    p_payment_method => p_payment_method,
    p_delivery_address => p_delivery_address,
    p_hub_order_id => p_hub_order_id,
    p_source => p_source,
    p_note => p_note
  ) as f;

  if p_line_configurations is null or jsonb_typeof(p_line_configurations) <> 'array' then
    raise exception 'p_line_configurations must be a JSON array';
  end if;

  if jsonb_array_length(p_line_configurations) <> jsonb_array_length(p_items) then
    raise exception 'line configuration count must match order item count';
  end if;

  if p_requested_for is not null then
    update public.sub_orders
      set requested_for = p_requested_for
      where sub_id = v_sub_id;
  end if;

  for v_config in select * from jsonb_array_elements(p_line_configurations)
  loop
    insert into public.order_line_configurations (
      sub_id, shop_id, line_ref, line_kind, menu_item_id, bundle_id,
      item_name_snapshot, base_price_snapshot, unit_price_snapshot, qty,
      options_snapshot, bundle_selections_snapshot, item_note
    ) values (
      v_sub_id,
      p_shop_id,
      v_config->>'line_ref',
      v_config->>'line_kind',
      case when nullif(v_config->>'menu_item_id', '') is null then null else (v_config->>'menu_item_id')::uuid end,
      case when nullif(v_config->>'bundle_id', '') is null then null else (v_config->>'bundle_id')::uuid end,
      v_config->>'item_name_snapshot',
      (v_config->>'base_price_snapshot')::numeric,
      (v_config->>'unit_price_snapshot')::numeric,
      (v_config->>'qty')::integer,
      coalesce(v_config->'options_snapshot', '[]'::jsonb),
      coalesce(v_config->'bundle_selections_snapshot', '[]'::jsonb),
      nullif(v_config->>'item_note', '')
    );
  end loop;

  return query select v_hub_order_id, v_sub_id;
end;
$function$;

revoke all on function public.fn_create_order_v2(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, timestamptz, uuid, text, text
) from public;
revoke execute on function public.fn_create_order_v2(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, timestamptz, uuid, text, text
) from anon, authenticated;
grant execute on function public.fn_create_order_v2(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, timestamptz, uuid, text, text
) to service_role;
