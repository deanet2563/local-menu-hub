-- MyTree order chat foundation. Reuses the existing chat_messages table and only adds missing fields.

alter table public.chat_messages
  add column if not exists message_id uuid default gen_random_uuid(),
  add column if not exists sub_id uuid references public.sub_orders(sub_id) on delete cascade,
  add column if not exists sender_role text,
  add column if not exists body text,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists chat_messages_message_id_uidx on public.chat_messages(message_id);
create index if not exists chat_messages_sub_id_created_idx on public.chat_messages(sub_id, created_at);

alter table public.chat_messages drop constraint if exists chat_messages_sender_role_check;
alter table public.chat_messages add constraint chat_messages_sender_role_check
  check (sender_role is null or sender_role in ('customer','shop','admin'));

create or replace function public.fn_can_access_order_chat(p_sub_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.fn_is_my_order_sub(p_sub_id)
    or exists (
      select 1
      from public.sub_orders s
      where s.sub_id = p_sub_id
        and s.shop_id in (select public.fn_staff_shop_ids())
    )
    or public.fn_is_platform_admin();
$$;

alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_order_participants_select on public.chat_messages;
create policy chat_messages_order_participants_select on public.chat_messages
for select using (sub_id is not null and public.fn_can_access_order_chat(sub_id));

drop policy if exists chat_messages_order_participants_insert on public.chat_messages;
create policy chat_messages_order_participants_insert on public.chat_messages
for insert with check (
  sub_id is not null
  and body is not null
  and length(trim(body)) between 1 and 2000
  and public.fn_can_access_order_chat(sub_id)
);

revoke all on function public.fn_can_access_order_chat(uuid) from public;
grant execute on function public.fn_can_access_order_chat(uuid) to authenticated, anon;
