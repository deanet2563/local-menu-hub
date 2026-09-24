-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/migrations/20260923120200_head_office_rbac_production_policy_cleanup.sql
-- Canonical blob SHA: bbe4f3481f96e9952cdcf9c6cb7b6f267dda610b

-- Corrective production cleanup for rider scoped-read policy discovered
-- during post-migration verification after the RBAC/Audit foundation rollout.
-- Preserve existing rider/shop/order visibility clauses; replace only the raw
-- platform_admins bypass with the canonical riders.read permission.

drop policy if exists rider_reads_scoped_rows on public.riders;

create policy rider_reads_scoped_rows
  on public.riders
  for select
  using (
    customer_id = (auth.jwt() ->> 'customer_id')::uuid
    or public.fn_admin_has_permission('riders.read')
    or (
      is_online = true
      and is_approved = true
      and is_banned = false
      and offers_delivery = true
      and exists (select 1 from public.fn_staff_shop_ids())
    )
    or exists (
      select 1
      from public.sub_orders s
      where s.assigned_rider_id = riders.id
        and s.order_id in (select public.fn_my_hub_order_ids())
    )
  );
