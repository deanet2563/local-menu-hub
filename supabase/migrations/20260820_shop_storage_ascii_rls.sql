-- MyTree Shop storage: authorize authenticated shop staff to use the
-- ASCII-safe folder derived from shop_id by src/lib/storageKey.ts.

create or replace function public.fn_shop_storage_folder(p_shop_id text)
returns text
language sql
immutable
strict
as $$
  select 'shop-' || encode(convert_to(p_shop_id, 'UTF8'), 'hex');
$$;

revoke all on function public.fn_shop_storage_folder(text) from public;
grant execute on function public.fn_shop_storage_folder(text) to authenticated;

create policy "shop staff insert ascii shop assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shop-assets'
  and exists (
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
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
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
)
with check (
  bucket_id = 'shop-assets'
  and exists (
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
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
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
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
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
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
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
)
with check (
  bucket_id = 'shop-qr-codes'
  and exists (
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
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
    select 1 from public.shop_staff ss
    where ss.customer_id = auth.uid()
      and (storage.foldername(name))[1] = public.fn_shop_storage_folder(ss.shop_id)
  )
);
