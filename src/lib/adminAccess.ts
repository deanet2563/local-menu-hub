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

function parseAdminAccessContext(value: unknown): AdminAccessContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_ADMIN_ACCESS;
  }

  const raw = value as Record<string, unknown>;
  const role =
    typeof raw.role_key === "string" && ADMIN_ROLES.has(raw.role_key as AdminRoleKey)
      ? (raw.role_key as AdminRoleKey)
      : null;

  return {
    customer_id: typeof raw.customer_id === "string" ? raw.customer_id : null,
    is_active: raw.is_active === true,
    role_key: role,
    permissions: Array.isArray(raw.permissions)
      ? raw.permissions.filter((permission): permission is string => typeof permission === "string")
      : [],
  };
}

export async function getAdminAccessContext(): Promise<AdminAccessContext> {
  const { data, error } = await supabase.rpc("fn_admin_access_context");

  if (error) throw error;

  return parseAdminAccessContext(data);
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
