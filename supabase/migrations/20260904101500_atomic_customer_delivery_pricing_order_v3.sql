-- MyTree Ordering Flow v3 priced wrapper
-- Keeps the proven fn_create_order_v2 behavior intact while making the
-- customer-visible delivery charge + Rider fee payer snapshot transactional
-- with order creation.
--
-- IMPORTANT:
-- - customer_delivery_charge is NOT Rider compensation.
-- - delivery_fee remains the Rider compensation snapshot.
-- - delivery_fee_payer is customer OR shop only; never split.

create or replace function public.fn_create_order_v3_priced(
  p_shop_id text,
  p_items jsonb,
  p_line_configurations jsonb,
  p_customer_id uuid default null,
  p_fulfillment_type fulfillment_type_enum default 'pickup',
  p_payment_method payment_method_enum default 'qr_transfer',
  p_delivery_address text default null,
  p_delivery_destination_lat double precision default null,
  p_delivery_destination_lng double precision default null,
  p_requested_for timestamptz default null,
  p_hub_order_id uuid default null,
  p_source text default 'liff_checkout',
  p_note text default null,
  p_customer_delivery_charge numeric default 0,
  p_delivery_fee_payer text default 'customer'
)
returns table(out_hub_order_id uuid, out_sub_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hub_order_id uuid;
  v_sub_id uuid;
  v_customer_delivery_charge numeric;
  v_delivery_fee_payer text;
begin
  if p_customer_delivery_charge is null or p_customer_delivery_charge < 0 then
    raise exception 'customer delivery charge must be non-negative';
  end if;

  if p_delivery_fee_payer not in ('customer', 'shop') then
    raise exception 'delivery fee payer must be customer or shop';
  end if;

  -- Pickup orders never carry a customer delivery charge. The payer field is
  -- irrelevant for pickup, but keep the legacy default for a deterministic row.
  if p_fulfillment_type::text = 'pickup' then
    v_customer_delivery_charge := 0;
    v_delivery_fee_payer := 'customer';
  else
    v_customer_delivery_charge := round(p_customer_delivery_charge::numeric, 2);
    v_delivery_fee_payer := p_delivery_fee_payer;
  end if;

  -- fn_create_order_v2 is the existing validated order writer. This wrapper and
  -- the UPDATE below execute in the SAME PostgreSQL transaction. Any exception
  -- after order creation rolls back the order as well.
  select f.out_hub_order_id, f.out_sub_id
    into v_hub_order_id, v_sub_id
  from public.fn_create_order_v2(
    p_shop_id => p_shop_id,
    p_items => p_items,
    p_line_configurations => p_line_configurations,
    p_customer_id => p_customer_id,
    p_fulfillment_type => p_fulfillment_type,
    p_payment_method => p_payment_method,
    p_delivery_address => p_delivery_address,
    p_delivery_destination_lat => p_delivery_destination_lat,
    p_delivery_destination_lng => p_delivery_destination_lng,
    p_requested_for => p_requested_for,
    p_hub_order_id => p_hub_order_id,
    p_source => p_source,
    p_note => p_note
  ) as f;

  if v_sub_id is null then
    raise exception 'order creation returned no sub order id';
  end if;

  update public.sub_orders
     set customer_delivery_charge = v_customer_delivery_charge,
         delivery_fee_payer = v_delivery_fee_payer
   where sub_id = v_sub_id;

  if not found then
    raise exception 'failed to persist atomic delivery pricing snapshot';
  end if;

  return query select v_hub_order_id, v_sub_id;
end;
$function$;

revoke all on function public.fn_create_order_v3_priced(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, double precision, double precision, timestamptz, uuid, text, text,
  numeric, text
) from public;

revoke execute on function public.fn_create_order_v3_priced(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, double precision, double precision, timestamptz, uuid, text, text,
  numeric, text
) from anon, authenticated;

grant execute on function public.fn_create_order_v3_priced(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, double precision, double precision, timestamptz, uuid, text, text,
  numeric, text
) to service_role;

comment on function public.fn_create_order_v3_priced(
  text, jsonb, jsonb, uuid, fulfillment_type_enum, payment_method_enum,
  text, double precision, double precision, timestamptz, uuid, text, text,
  numeric, text
) is
  'Atomic order writer for verified checkout pricing. Calls fn_create_order_v2 and freezes customer_delivery_charge + delivery_fee_payer in one DB transaction.';
