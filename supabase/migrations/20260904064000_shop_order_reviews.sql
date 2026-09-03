-- MyTree reputation foundation: one review per completed order, immutable customer review content,
-- with a separate merchant reply controlled by the shop.

create table if not exists public.shop_order_reviews (
  review_id uuid primary key default gen_random_uuid(),
  sub_id uuid not null unique references public.sub_orders(sub_id) on delete restrict,
  shop_id uuid not null references public.shops(shop_id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  is_verified_order boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_order_reviews_text_length check (review_text is null or length(review_text) <= 3000)
);

create table if not exists public.shop_review_replies (
  reply_id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.shop_order_reviews(review_id) on delete cascade,
  shop_id uuid not null references public.shops(shop_id) on delete restrict,
  reply_text text not null check (length(trim(reply_text)) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shop_order_reviews_shop_created on public.shop_order_reviews(shop_id, created_at desc);
create index if not exists idx_shop_order_reviews_customer_created on public.shop_order_reviews(customer_id, created_at desc);

alter table public.shop_order_reviews enable row level security;
alter table public.shop_review_replies enable row level security;

create or replace function public.fn_can_review_order(p_sub_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sub_orders s
    join public.hub_orders h on h.order_id = s.order_id
    where s.sub_id = p_sub_id
      and h.customer_id = (auth.jwt() ->> 'customer_id')::uuid
      and s.order_status = 'completed'
      and (s.fulfillment_type = 'pickup' or s.delivery_status = 'delivered')
  );
$$;

create or replace function public.fn_guard_shop_order_review_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.sub_id is distinct from old.sub_id
      or new.shop_id is distinct from old.shop_id
      or new.customer_id is distinct from old.customer_id
      or new.rating is distinct from old.rating
      or new.review_text is distinct from old.review_text
      or new.is_verified_order is distinct from old.is_verified_order
      or new.created_at is distinct from old.created_at then
      raise exception 'customer review content is immutable after submission';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_shop_order_review_immutable on public.shop_order_reviews;
create trigger trg_guard_shop_order_review_immutable
before update on public.shop_order_reviews
for each row execute function public.fn_guard_shop_order_review_immutable();

drop policy if exists shop_order_reviews_public_select on public.shop_order_reviews;
create policy shop_order_reviews_public_select on public.shop_order_reviews
for select using (true);

drop policy if exists shop_order_reviews_customer_insert on public.shop_order_reviews;
create policy shop_order_reviews_customer_insert on public.shop_order_reviews
for insert with check (
  customer_id = (auth.jwt() ->> 'customer_id')::uuid
  and public.fn_can_review_order(sub_id)
  and exists (
    select 1 from public.sub_orders s
    where s.sub_id = shop_order_reviews.sub_id
      and s.shop_id = shop_order_reviews.shop_id
  )
);

drop policy if exists shop_review_replies_public_select on public.shop_review_replies;
create policy shop_review_replies_public_select on public.shop_review_replies
for select using (true);

drop policy if exists shop_review_replies_staff_insert on public.shop_review_replies;
create policy shop_review_replies_staff_insert on public.shop_review_replies
for insert with check (
  shop_id = any(public.fn_staff_shop_ids())
  and exists (
    select 1 from public.shop_order_reviews r
    where r.review_id = shop_review_replies.review_id
      and r.shop_id = shop_review_replies.shop_id
  )
);

drop policy if exists shop_review_replies_staff_update on public.shop_review_replies;
create policy shop_review_replies_staff_update on public.shop_review_replies
for update using (shop_id = any(public.fn_staff_shop_ids()))
with check (shop_id = any(public.fn_staff_shop_ids()));

grant execute on function public.fn_can_review_order(uuid) to authenticated;
