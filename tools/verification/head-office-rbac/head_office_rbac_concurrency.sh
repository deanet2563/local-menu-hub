#!/usr/bin/env bash
set -euo pipefail

DB_ARGS=(-h localhost -U postgres -d mytree_rbac_test)
export PGPASSWORD=postgres

# Add a second active Super Admin for race testing.
psql "${DB_ARGS[@]}" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.customers(id, name)
values ('00000000-0000-0000-0000-000000000009', 'race super')
on conflict (id) do nothing;

insert into public.platform_admins(customer_id, role, is_active)
values ('00000000-0000-0000-0000-000000000009', 'super_admin', true)
on conflict (customer_id) do update
set role = 'super_admin', is_active = true, disabled_at = null, disabled_reason = null;

update public.platform_admins
set role = 'super_admin', is_active = true, disabled_at = null, disabled_reason = null
where customer_id = '00000000-0000-0000-0000-000000000001';
SQL

run_role_change() {
  local actor="$1"
  local target="$2"
  local tag="$3"
  psql "${DB_ARGS[@]}" -v ON_ERROR_STOP=1 <<SQL
set role authenticated;
select set_config('request.jwt.claims', '{"customer_id":"$actor"}', false);
select public.fn_admin_set_role(
  '$target',
  'read_only_analyst',
  '$tag'
);
SQL
}

set +e
run_role_change   "00000000-0000-0000-0000-000000000001"   "00000000-0000-0000-0000-000000000009"   "concurrent role A" > /tmp/rbac-role-a.log 2>&1 &
pid_a=$!

run_role_change   "00000000-0000-0000-0000-000000000009"   "00000000-0000-0000-0000-000000000001"   "concurrent role B" > /tmp/rbac-role-b.log 2>&1 &
pid_b=$!

wait "$pid_a"; status_a=$?
wait "$pid_b"; status_b=$?
set -e

cat /tmp/rbac-role-a.log
cat /tmp/rbac-role-b.log

if [[ "$status_a" -eq 0 && "$status_b" -eq 0 ]]; then
  echo "ERROR: both concurrent Super Admin demotions succeeded"
  exit 1
fi

if [[ "$status_a" -ne 0 && "$status_b" -ne 0 ]]; then
  echo "ERROR: both concurrent Super Admin demotions failed; expected exactly one success"
  exit 1
fi

active_supers=$(psql "${DB_ARGS[@]}" -Atc   "select count(*) from public.platform_admins where role::text='super_admin' and is_active=true;")

if [[ "$active_supers" != "1" ]]; then
  echo "ERROR: expected exactly 1 active Super Admin after demotion race, got $active_supers"
  exit 1
fi

# Reset both rows and test the same invariant for concurrent disable.
psql "${DB_ARGS[@]}" -v ON_ERROR_STOP=1 <<'SQL'
update public.platform_admins
set role = 'super_admin', is_active = true, disabled_at = null, disabled_reason = null
where customer_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000009'
);
SQL

run_disable() {
  local actor="$1"
  local target="$2"
  local tag="$3"
  psql "${DB_ARGS[@]}" -v ON_ERROR_STOP=1 <<SQL
set role authenticated;
select set_config('request.jwt.claims', '{"customer_id":"$actor"}', false);
select public.fn_admin_set_active(
  '$target',
  false,
  '$tag'
);
SQL
}

set +e
run_disable   "00000000-0000-0000-0000-000000000001"   "00000000-0000-0000-0000-000000000009"   "concurrent disable A" > /tmp/rbac-disable-a.log 2>&1 &
pid_a=$!

run_disable   "00000000-0000-0000-0000-000000000009"   "00000000-0000-0000-0000-000000000001"   "concurrent disable B" > /tmp/rbac-disable-b.log 2>&1 &
pid_b=$!

wait "$pid_a"; status_a=$?
wait "$pid_b"; status_b=$?
set -e

cat /tmp/rbac-disable-a.log
cat /tmp/rbac-disable-b.log

if [[ "$status_a" -eq 0 && "$status_b" -eq 0 ]]; then
  echo "ERROR: both concurrent Super Admin disables succeeded"
  exit 1
fi

if [[ "$status_a" -ne 0 && "$status_b" -ne 0 ]]; then
  echo "ERROR: both concurrent Super Admin disables failed; expected exactly one success"
  exit 1
fi

active_supers=$(psql "${DB_ARGS[@]}" -Atc   "select count(*) from public.platform_admins where role::text='super_admin' and is_active=true;")

if [[ "$active_supers" != "1" ]]; then
  echo "ERROR: expected exactly 1 active Super Admin after disable race, got $active_supers"
  exit 1
fi

echo "head_office_super_admin_concurrency_tests_passed"
