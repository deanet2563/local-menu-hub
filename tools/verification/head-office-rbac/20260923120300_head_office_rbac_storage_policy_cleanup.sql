-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/migrations/20260923120300_head_office_rbac_storage_policy_cleanup.sql
-- Canonical blob SHA: bd950e6a1fbe3d536b573d85a3c746a241718f4e

-- Corrective RBAC cleanup for private delivery-proof storage policy.
-- Preserve rider/shop/customer order-scoped access and replace only the raw
-- platform_admins bypass with the canonical orders.read permission.

drop policy if exists "delivery principals read private delivery proof"
  on storage.objects;

create policy "delivery principals read private delivery proof"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'delivery-proofs'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1
      from public.sub_orders so
      where so.sub_id::text = (storage.foldername(objects.name))[1]
        and (
          exists (
            select 1
            from public.riders r
            where r.id = so.assigned_rider_id
              and r.customer_id::text = nullif(auth.jwt() ->> 'customer_id', '')
          )
          or exists (
            select 1
            from public.shop_staff ss
            where ss.shop_id = so.shop_id
              and ss.customer_id::text = nullif(auth.jwt() ->> 'customer_id', '')
          )
          or so.order_id in (select public.fn_my_hub_order_ids())
          or public.fn_admin_has_permission('orders.read')
        )
    )
  );
