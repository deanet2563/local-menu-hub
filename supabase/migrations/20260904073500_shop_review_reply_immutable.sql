-- MyTree review integrity: merchant may reply once, but may not edit the reply afterward.

drop policy if exists shop_review_replies_staff_update on public.shop_review_replies;

create or replace function public.fn_guard_shop_review_reply_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'shop review reply is immutable after submission';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_shop_review_reply_immutable on public.shop_review_replies;
create trigger trg_guard_shop_review_reply_immutable
before update on public.shop_review_replies
for each row execute function public.fn_guard_shop_review_reply_immutable();
