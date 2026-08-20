-- MyTree Shop storage RLS repair.
-- The LINE auth broker carries the internal identity in the JWT customer_id claim.
-- Storage policies must accept that claim (with auth.uid() as a compatibility fallback)
-- rather than assuming shop_staff.customer_id always equals auth.uid().

create or replace function public.fn_current_customer_id_text()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'customer_id', ''),
    auth.uid()::text
  );
$$;

revoke all on function public.fn_current_customer_id_text() from public;
grant execute on function public.fn_current_customer_id_text() to authenticated;

-- Replace the ASCII-folder policies created by 20260820_shop_storage_ascii_rls.sql.
drop policy if exists "shop staff insert ascii shop assets" on storage.objects;
drop policy if exists "shop staff update ascii shop assets" on storage.objects;
drop policy if exists "shop staff delete ascii shop assets" on storage.objects;
drop policy if exists "shop staff insert ascii shop qr" on storage.objects;
drop policy if exists "shop staff update ascii shop qr" on storage.objects;
drop policy if exists "shop staff delete ascii shop qr" on storage.objects;

create policy "shop staff insert ascii shop assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shop-assets'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
);

create policy "shop staff update ascii shop assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shop-assets'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
)
with check (
  bucket_id = 'shop-assets'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
);

create policy "shop staff delete ascii shop assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shop-assets'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
);

create policy "shop staff insert ascii shop qr"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shop-qr-codes'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
);

create policy "shop staff update ascii shop qr"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shop-qr-codes'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
)
with check (
  bucket_id = 'shop-qr-codes'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
);

create policy "shop staff delete ascii shop qr"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shop-qr-codes'
  and exists (
    select 1
    from public.shop_staff ss
    where ss.customer_id::text = public.fn_current_customer_id_text()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
);
