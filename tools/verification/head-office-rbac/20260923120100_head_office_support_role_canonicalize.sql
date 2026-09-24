-- VERIFICATION-ONLY MIRROR. DO NOT APPLY FROM local-menu-hub.
-- Canonical source: deanet2563/mytree-worker/supabase/migrations/20260923120100_head_office_support_role_canonicalize.sql
-- Canonical blob SHA: db623d81e5cef378c3b84d9eee47d7ae40f531fb

-- Stage 2 canonicalization for the legacy support enum value.
-- This is deliberately separate from the enum-extension migration so the new
-- enum value is committed before it is used in existing rows/defaults.

update public.platform_admins
set role = 'support_admin'::public.admin_role_enum,
    updated_at = now()
where role::text = 'support';

alter table public.platform_admins
  alter column role set default 'support_admin'::public.admin_role_enum;
