-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/tests/head_office_rbac_assertions.sql
-- Canonical blob SHA: c319630c18ec391bf3f88c840e2fd640759db0bf

\set ON_ERROR_STOP on

-- Seed identities.
insert into public.customers(id, name) values
  ('00000000-0000-0000-0000-000000000001', 'super'),
  ('00000000-0000-0000-0000-000000000003', 'shop admin'),
  ('00000000-0000-0000-0000-000000000004', 'rider admin'),
  ('00000000-0000-0000-0000-000000000005', 'moderation admin'),
  ('00000000-0000-0000-0000-000000000006', 'analyst'),
  ('00000000-0000-0000-0000-000000000007', 'finance admin'),
  ('00000000-0000-0000-0000-000000000008', 'operations admin'),
  ('00000000-0000-0000-0000-000000000099', 'ordinary user'),
  ('10000000-0000-0000-0000-000000000001', 'target customer'),
  ('20000000-0000-0000-0000-000000000001', 'target rider'),
  ('20000000-0000-0000-0000-000000000002', 'verify target rider');

insert into public.platform_admins(customer_id, role) values
  ('00000000-0000-0000-0000-000000000001', 'super_admin'),
  ('00000000-0000-0000-0000-000000000003', 'shop_admin'),
  ('00000000-0000-0000-0000-000000000004', 'rider_admin'),
  ('00000000-0000-0000-0000-000000000005', 'moderation_admin'),
  ('00000000-0000-0000-0000-000000000006', 'read_only_analyst'),
  ('00000000-0000-0000-0000-000000000007', 'finance_admin'),
  ('00000000-0000-0000-0000-000000000008', 'operations_admin');

insert into public.shops(shop_id, name) values ('shop-test', 'Test Shop');

insert into public.riders(
  id, customer_id, name, is_online, is_approved, rider_class, plate_number, win_registration_no
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Test Rider',
    false,
    false,
    'general',
    null,
    null
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Verify Rider',
    false,
    false,
    'public_win',
    'TEST-PLATE',
    'WIN-TEST'
  );

insert into public.hub_orders(order_id, customer_id)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

insert into public.sub_orders(sub_id, order_id, shop_id, assigned_rider_id)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'shop-test',
    null
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'shop-test',
    null
  );

insert into public.order_items(item_id, sub_id, shop_id)
values (
  '32000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'shop-test'
);

insert into public.daily_shop_sales_summary(shop_id, sales_date)
values ('shop-test', current_date);

insert into public.subscription_payments(payment_id, amount)
values ('33000000-0000-0000-0000-000000000001', 100);

set role authenticated;

-- Unauthorized user is not an admin and has no permission.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000099"}',
  false
);

do $$
begin
  if public.fn_is_platform_admin() then
    raise exception 'unauthorized user unexpectedly recognized as platform admin';
  end if;
  if public.fn_admin_has_permission('shops.read') then
    raise exception 'unauthorized user unexpectedly has shops.read';
  end if;
end $$;

-- Legacy "support" maps to support_admin permissions.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000002"}',
  false
);

do $$
declare
  ctx jsonb;
begin
  if not public.fn_is_platform_admin() then
    raise exception 'legacy support row should remain an active platform admin';
  end if;
  if not public.fn_admin_has_permission('members.read') then
    raise exception 'legacy support should inherit support_admin members.read';
  end if;
  if public.fn_admin_has_permission('shops.action') then
    raise exception 'support admin must not inherit shop governance actions';
  end if;

  ctx := public.fn_admin_access_context();
  if (select role::text from public.platform_admins where customer_id = '00000000-0000-0000-0000-000000000002') <> 'support_admin' then
    raise exception 'legacy support row was not canonicalized by stage 2 migration';
  end if;
  if ctx ->> 'role_key' <> 'support_admin' then
    raise exception 'legacy support role was not canonicalized in access context: %', ctx;
  end if;
end $$;

-- Shop Admin is domain-scoped.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000003"}',
  false
);

do $$
begin
  if not public.fn_admin_has_permission('shops.action') then
    raise exception 'shop admin missing shops.action';
  end if;
  if public.fn_admin_has_permission('riders.action') then
    raise exception 'shop admin unexpectedly has riders.action';
  end if;
  if public.fn_admin_has_permission('system.admin') then
    raise exception 'shop admin unexpectedly has system.admin';
  end if;
end $$;

-- Direct role escalation is blocked by table grants.
do $$
begin
  begin
    update public.platform_admins
    set role = 'super_admin'
    where customer_id = '00000000-0000-0000-0000-000000000003';
    raise exception 'direct platform_admins role update unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- RPC privilege escalation is blocked as well.
do $$
begin
  begin
    perform public.fn_admin_set_role(
      '00000000-0000-0000-0000-000000000003',
      'super_admin',
      'attempted escalation'
    );
    raise exception 'shop admin unexpectedly changed an admin role';
  exception
    when others then
      if sqlerrm not like 'permission denied:%' then
        raise;
      end if;
  end;
end $$;

-- Existing Shop approve flow remains compatible for an authorized scoped role.
select public.fn_approve_shop('shop-test');

do $blk$
begin
  if not (select is_approved from public.shops where shop_id = 'shop-test') then
    raise exception 'shop approve flow did not persist';
  end if;
end $blk$;

-- Live-production drift: shop category admin RPCs must use shops.action rather
-- than raw platform_admins row existence.
do $do$
declare
  v_category_id uuid;
begin
  v_category_id := public.fn_admin_create_shop_category('RBAC Test Category', null, 90);
  perform public.fn_admin_update_shop_category(
    v_category_id,
    'RBAC Test Category Updated',
    null,
    91,
    false
  );

  if not exists (
    select 1
    from public.shop_category_master
    where category_id = v_category_id
      and label = 'RBAC Test Category Updated'
      and is_active = false
  ) then
    raise exception 'shop category RBAC admin flow did not persist';
  end if;
end
$do$;

-- A Shop Admin does not get the orders.action override merely by being present
-- in platform_admins.
do $blk$
begin
  begin
    perform public.fn_shop_request_delivery_v3(
      '31000000-0000-0000-0000-000000000001'
    );
    raise exception 'shop admin unexpectedly received orders.action delivery override';
  exception
    when others then
      if sqlerrm not like 'shop_actor_not_authorized%' then
        raise;
      end if;
  end;
end $blk$;

-- The same Shop Admin cannot invoke Rider governance.
do $$
begin
  begin
    perform public.fn_approve_rider('20000000-0000-0000-0000-000000000001');
    raise exception 'shop admin unexpectedly approved a rider';
  exception
    when others then
      if sqlerrm not like 'permission denied: riders.action%' then
        raise;
      end if;
  end;
end $$;

-- Rider Admin can approve Rider through the legacy RPC signature.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000004"}',
  false
);
select public.fn_approve_rider('20000000-0000-0000-0000-000000000001');

do $do$
begin
  if not (select is_approved from public.riders where id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'rider approve flow did not persist';
  end if;
end $do$;


-- Rider document verification must be authorized and audited as verify, even
-- when verification also approves the rider in the same UPDATE.
select public.fn_verify_rider_document('20000000-0000-0000-0000-000000000002');

-- Moderation Admin can ban a customer; Shop Admin cannot.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000003"}',
  false
);
do $$
begin
  begin
    perform public.fn_ban_customer(
      '10000000-0000-0000-0000-000000000001',
      'shop admin must not moderate'
    );
    raise exception 'shop admin unexpectedly banned a customer';
  exception
    when others then
      if sqlerrm not like 'permission denied: moderation.action%' then
        raise;
      end if;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000005"}',
  false
);
select public.fn_ban_customer(
  '10000000-0000-0000-0000-000000000001',
  'moderation regression test'
);

-- Read-only Analyst receives reads but no action/admin permission.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000006"}',
  false
);
do $blk$
begin
  if not public.fn_admin_has_permission('analytics.read') then
    raise exception 'read-only analyst missing analytics.read';
  end if;
  if public.fn_admin_has_permission('shops.action')
     or public.fn_admin_has_permission('system.admin') then
    raise exception 'read-only analyst received mutation permission';
  end if;
end $blk$;

do $blk$
begin
  begin
    perform public.fn_admin_create_shop_category('Analyst Escalation', null, 100);
    raise exception 'read-only analyst unexpectedly created shop category';
  exception
    when others then
      if sqlerrm not like 'permission denied: shops.action%' then
        raise;
      end if;
  end;
end $blk$;

-- Read-only Analyst can read order/analytics surfaces but cannot obtain broad
-- action-only access or finance data.
do $do$
declare
  n_orders bigint;
  n_items bigint;
  n_daily bigint;
  n_sub bigint;
  n_payments bigint;
begin
  select count(*) into n_orders from public.hub_orders;
  select count(*) into n_items from public.order_items;
  select count(*) into n_daily from public.daily_shop_sales_summary;
  select count(*) into n_sub from public.sub_orders;
  select count(*) into n_payments from public.subscription_payments;

  if n_orders <> 1 or n_items <> 1 or n_daily <> 1 then
    raise exception 'read-only analyst read permissions incomplete: orders %, items %, daily %',
      n_orders, n_items, n_daily;
  end if;
  if n_sub <> 0 then
    raise exception 'read-only analyst unexpectedly received orders.action sub-order access';
  end if;
  if n_payments <> 0 then
    raise exception 'read-only analyst unexpectedly received finance.action access';
  end if;
end $do$;

-- Audit stream is not exposed to ordinary scoped admins without audit permission.
do $do$
declare n bigint;
begin
  select count(*) into n from public.admin_audit_log;
  if n <> 0 then
    raise exception 'read-only analyst should not see audit rows through RLS';
  end if;
end $do$;

-- Finance Admin receives finance.action but not order mutation authority.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000007"}',
  false
);
do $do$
declare
  n_payments bigint;
  n_sub bigint;
begin
  select count(*) into n_payments from public.subscription_payments;
  select count(*) into n_sub from public.sub_orders;
  if n_payments <> 1 then
    raise exception 'finance admin cannot read subscription payments';
  end if;
  if n_sub <> 0 then
    raise exception 'finance admin unexpectedly received orders.action access';
  end if;
end $do$;

-- Production-drift delivery admin bypass must be orders.action-scoped.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000008"}',
  false
);
select * from public.fn_shop_request_delivery_v3(
  '31000000-0000-0000-0000-000000000001'
);
select * from public.fn_shop_reoffer_delivery_v3(
  '31000000-0000-0000-0000-000000000001',
  'test',
  null
);
select * from public.fn_shop_cancel_delivery_v3(
  '31000000-0000-0000-0000-000000000001',
  'test',
  null
);

do $do$
declare
  n bigint;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.prokind = 'f'
    and p.proname in (
      'fn_shop_request_delivery_v3',
      'fn_shop_reoffer_delivery_v3',
      'fn_shop_cancel_delivery_v3'
    )
    and pg_get_functiondef(p.oid) ilike '%platform_admins%';

  if n <> 0 then
    raise exception 'live delivery admin RPC definitions still reference platform_admins directly';
  end if;
end
$do$;

-- Operations Admin receives orders.action and can use the legacy all-command
-- sub_orders policy only within that permission.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000008"}',
  false
);
delete from public.sub_orders
where sub_id = '31000000-0000-0000-0000-000000000002';

do $do$
begin
  if exists (
    select 1 from public.sub_orders
    where sub_id = '31000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'operations admin orders.action delete did not execute';
  end if;
end $do$;

-- Super Admin can read audit, manage admin lifecycle, and cannot lock out self.
select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000001"}',
  false
);

do $$
declare n bigint;
begin
  select count(*) into n from public.admin_audit_log;
  if n < 4 then
    raise exception 'expected governance audit rows, found %', n;
  end if;

  if not exists (
    select 1
    from public.admin_audit_log
    where target_type = 'riders'
      and target_id = '20000000-0000-0000-0000-000000000002'
      and action = 'riders.verify'
  ) then
    raise exception 'rider verification was not classified as riders.verify in audit';
  end if;

  begin
    perform public.fn_admin_set_active(
      '00000000-0000-0000-0000-000000000001',
      false,
      'self lockout test'
    );
    raise exception 'self-disable unexpectedly succeeded';
  exception
    when others then
      if sqlerrm <> 'cannot disable current admin account' then
        raise;
      end if;
  end;

  begin
    perform public.fn_admin_set_role(
      '00000000-0000-0000-0000-000000000001',
      'read_only_analyst',
      'self demotion test'
    );
    raise exception 'self role change unexpectedly succeeded';
  exception
    when others then
      if sqlerrm <> 'cannot change current admin role' then
        raise;
      end if;
  end;
end $$;

-- Disable another admin and prove active-state enforcement is immediate.
select public.fn_admin_set_active(
  '00000000-0000-0000-0000-000000000002',
  false,
  'inactive-state regression test'
);

select set_config(
  'request.jwt.claims',
  '{"customer_id":"00000000-0000-0000-0000-000000000002"}',
  false
);

do $do$
declare
  ctx jsonb;
  n_orders bigint;
  n_items bigint;
  n_daily bigint;
  n_sub bigint;
  n_payments bigint;
begin
  if public.fn_is_platform_admin() then
    raise exception 'disabled admin still recognized as active';
  end if;
  if public.fn_admin_has_permission('members.read') then
    raise exception 'disabled admin still has permissions';
  end if;

  ctx := public.fn_admin_access_context();
  if (ctx ->> 'is_active')::boolean then
    raise exception 'disabled admin access context still active';
  end if;

  select count(*) into n_orders from public.hub_orders;
  select count(*) into n_items from public.order_items;
  select count(*) into n_daily from public.daily_shop_sales_summary;
  select count(*) into n_sub from public.sub_orders;
  select count(*) into n_payments from public.subscription_payments;

  if n_orders <> 0 or n_items <> 0 or n_daily <> 0 or n_sub <> 0 or n_payments <> 0 then
    raise exception 'disabled admin retained legacy RLS access: orders %, items %, daily %, sub %, payments %',
      n_orders, n_items, n_daily, n_sub, n_payments;
  end if;
end $do$;

reset role;

select 'head_office_rbac_audit_tests_passed' as result;


-- No production-facing RLS policy may retain an admin bypass based only on a
-- platform_admins row. The self-read policy on platform_admins itself is excluded.
do $cleanup$
declare
  n bigint;
begin
  select count(*) into n
  from pg_policies
  where not (schemaname = 'public' and tablename = 'platform_admins')
    and (
      coalesce(qual, '') ilike '%platform_admins%'
      or coalesce(with_check, '') ilike '%platform_admins%'
    );

  if n <> 0 then
    raise exception 'residual raw platform_admins RLS policies remain: %', n;
  end if;
end
$cleanup$;


-- lifecycle authority hardening verification
do $final$
declare
  n_revoke bigint;
  role_def text;
  active_def text;
  lock_pos integer;
  recheck_pos integer;
begin
  select count(*) into n_revoke
  from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public'
    and p.proname='fn_revoke_rider'
    and p.prokind='f';

  if n_revoke <> 1 then
    raise exception 'fn_revoke_rider overload count must be 1, found %', n_revoke;
  end if;

  if to_regprocedure('public.fn_revoke_rider(uuid)') is not null then
    raise exception 'legacy fn_revoke_rider(uuid) overload still exists';
  end if;

  select pg_get_functiondef(p.oid) into role_def
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname='fn_admin_set_role'
  limit 1;

  select pg_get_functiondef(p.oid) into active_def
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname='fn_admin_set_active'
  limit 1;

  lock_pos := strpos(role_def, 'pg_advisory_xact_lock');
  recheck_pos := strpos(substr(role_def, lock_pos + 1), 'fn_admin_has_permission(''system.admin'')');
  if lock_pos = 0 or recheck_pos = 0 then
    raise exception 'fn_admin_set_role missing post-lock permission recheck';
  end if;

  lock_pos := strpos(active_def, 'pg_advisory_xact_lock');
  recheck_pos := strpos(substr(active_def, lock_pos + 1), 'fn_admin_has_permission(''system.admin'')');
  if lock_pos = 0 or recheck_pos = 0 then
    raise exception 'fn_admin_set_active missing post-lock permission recheck';
  end if;
end
$final$;
