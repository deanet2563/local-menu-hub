-- MyTree Shop storage hardening: evaluate shop ownership through a SECURITY DEFINER
-- helper so storage.objects RLS is not blocked by RLS on public.shop_staff itself.

create or replace function public.fn_can_manage_shop_storage(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = coalesce(nullif(auth.jwt() ->> 'customer_id', ''), auth.uid()::text)
      and public.fn_shop_storage_folder(ss.shop_id) = p_folder
  );
$$;

revoke all on function public.fn_can_manage_shop_storage(text) from public;
grant execute on function public.fn_can_manage_shop_storage(text) to authenticated;

-- Replace the ASCII-folder policies with SECURITY DEFINER-backed checks.
drop policy if exists "shop staff select ascii shop assets" on storage.objects;
drop policy if exists "shop staff insert ascii shop assets" on storage.objects;
drop policy if exists "shop staff update ascii shop assets" on storage.objects;
drop policy if exists "shop staff delete ascii shop assets" on storage.objects;
drop policy if exists "shop staff select ascii shop qr" on storage.objects;
drop policy if exists "shop staff insert ascii shop qr" on storage.objects;
drop policy if exists "shop staff update ascii shop qr" on storage.objects;
drop policy if exists "shop staff delete ascii shop qr" on storage.objects;

create policy "shop staff select ascii shop assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'shop-assets'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);

create policy "shop staff insert ascii shop assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shop-assets'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);

create policy "shop staff update ascii shop assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shop-assets'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
)
with check (
  bucket_id = 'shop-assets'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);

create policy "shop staff delete ascii shop assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shop-assets'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);

create policy "shop staff select ascii shop qr"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'shop-qr-codes'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);

create policy "shop staff insert ascii shop qr"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shop-qr-codes'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);

create policy "shop staff update ascii shop qr"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shop-qr-codes'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
)
with check (
  bucket_id = 'shop-qr-codes'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);

create policy "shop staff delete ascii shop qr"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shop-qr-codes'
  and public.fn_can_manage_shop_storage((storage.foldername(name))[1])
);
