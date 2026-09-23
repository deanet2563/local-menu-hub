import { supabase } from "@/lib/supabase";

export type AdminRoleKey =
  | "super_admin"
  | "operations_admin"
  | "community_admin"
  | "moderation_admin"
  | "shop_admin"
  | "rider_admin"
  | "finance_admin"
  | "support_admin"
  | "marketing_admin"
  | "read_only_analyst";

export type AdminAccessContext = {
  customer_id: string | null;
  is_active: boolean;
  role_key: AdminRoleKey | null;
  permissions: string[];
};

const EMPTY_ADMIN_ACCESS: AdminAccessContext = {
  customer_id: null,
  is_active: false,
  role_key: null,
  permissions: [],
};

const ADMIN_ROLES = new Set<AdminRoleKey>([
  "super_admin",
  "operations_admin",
  "community_admin",
  "moderation_admin",
  "shop_admin",
  "rider_admin",
  "finance_admin",
  "support_admin",
  "marketing_admin",
  "read_only_analyst",
]);

function canonicalRole(value: unknown): AdminRoleKey | null {
  if (value === "support") return "support_admin";
  if (typeof value === "string" && ADMIN_ROLES.has(value as AdminRoleKey)) {
    return value as AdminRoleKey;
  }
  return null;
}

function parseAdminAccessContext(value: unknown): AdminAccessContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_ADMIN_ACCESS;
  }

  const raw = value as Record<string, unknown>;

  return {
    customer_id: typeof raw.customer_id === "string" ? raw.customer_id : null,
    is_active: raw.is_active === true,
    role_key: canonicalRole(raw.role_key),
    permissions: Array.isArray(raw.permissions)
      ? raw.permissions.filter((permission): permission is string => typeof permission === "string")
      : [],
  };
}

/**
 * Migration compatibility fallback:
 * Head Office DB migration is deployed before the frontend in the normal rollout.
 * If the new access-context RPC is temporarily unavailable, preserve the existing
 * Platform Admin gate by reading only the caller's RLS-visible admin row.
 * This is UX compatibility only; server-side RPC/RLS enforcement remains authoritative.
 */
async function getLegacyAdminAccessContext(): Promise<AdminAccessContext> {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("customer_id,role")
    .maybeSingle();

  if (error) throw error;
  if (!data) return EMPTY_ADMIN_ACCESS;

  const row = data as { customer_id?: unknown; role?: unknown };
  const role = canonicalRole(row.role);

  return {
    customer_id: typeof row.customer_id === "string" ? row.customer_id : null,
    is_active: true,
    role_key: role,
    permissions: [],
  };
}

export async function getAdminAccessContext(): Promise<AdminAccessContext> {
  const { data, error } = await supabase.rpc("fn_admin_access_context");

  if (!error) return parseAdminAccessContext(data);

  return getLegacyAdminAccessContext();
}

export function hasAdminPermission(
  context: AdminAccessContext,
  permission: string,
): boolean {
  return (
    context.is_active &&
    (context.role_key === "super_admin" || context.permissions.includes(permission))
  );
}
