import { getAccessToken, supabase, WORKER_BASE } from "@/lib/supabase";

export type ShopReadiness = {
  ready: boolean;
  missing: string[];
  missing_count: number;
  available_menu_count: number;
  owner_count: number;
};

export type ShopListItem = {
  shop_id: string;
  name: string;
  category: string | null;
  phone: string | null;
  is_open: boolean;
  is_approved: boolean;
  is_banned: boolean;
  approval_rejected_at: string | null;
  approval_rejected_reason: string | null;
  deletion_status: string;
  created_at: string;
  last_active_at: string | null;
  status_updated_at: string;
  has_location: boolean;
  staff_count: number;
  menu_item_count: number;
  readiness: ShopReadiness;
};

export type ShopDetail = {
  shop: Record<string, unknown> & {
    shop_id: string;
    name: string;
    category: string | null;
    phone: string | null;
    is_open: boolean;
    is_approved: boolean;
    is_banned: boolean;
    banned_reason: string | null;
    approval_rejected_at: string | null;
    approval_rejected_reason: string | null;
    deletion_requested_at: string | null;
    deletion_reason: string | null;
    deletion_status: string;
  };
  readiness: ShopReadiness;
  staff: Array<{ customer_id: string; role: string; name: string | null; phone: string | null; created_at: string }>;
  menu: { total: number; available: number; unavailable: number };
  menu_items: Array<{ item_id:string; name:string; price:number|string; category:string|null; is_available:boolean; image_url:string|null }>;
  commerce: { total_orders: number; pending_orders: number; paid_orders: number };
  reviews: { count: number; average_rating: number | null };
  capabilities: { branch_model: boolean; pos_model: boolean; promotion_model: boolean; community_link: boolean };
  reminders: Array<{
    reminder_id: string;
    missing_fields: string[];
    delivery_channel: string;
    delivery_status: string;
    created_at: string;
  }>;
  audit: Array<{
    audit_id: number;
    actor_customer_id: string;
    actor_role_key: string;
    action: string;
    reason: string | null;
    created_at: string;
  }>;
};

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listShops(params: {
  search: string;
  approval: string;
  activity: string;
  category: string;
  sort: string;
  page: number;
}) {
  const { data, error } = await supabase.rpc("fn_admin_list_shops", {
    p_search: params.search || null,
    p_approval: params.approval || null,
    p_activity: params.activity || null,
    p_category: params.category || null,
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: 20,
  });
  check(error);
  const value = data as { items?: ShopListItem[]; total?: number; page?: number; page_size?: number } | null;
  return {
    items: value?.items ?? [],
    total: value?.total ?? 0,
    page: value?.page ?? params.page,
    pageSize: value?.page_size ?? 20,
  };
}

export async function getShop(id: string) {
  const { data, error } = await supabase.rpc("fn_admin_get_shop", { p_shop_id: id });
  check(error);
  return data as ShopDetail;
}

export type ShopLifecycleAction =
  | "approve"
  | "reject"
  | "ban"
  | "unban"
  | "deletion_approve"
  | "deletion_reject"
  | "deletion_defer";

export async function shopLifecycle(id: string, action: ShopLifecycleAction, reason: string) {
  const { error } = await supabase.rpc("fn_admin_shop_lifecycle", {
    p_shop_id: id,
    p_action: action,
    p_reason: reason,
  });
  check(error);
}

export async function sendShopProfileReminder(shopId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("ไม่พบ Admin access token");

  const response = await fetch(`${WORKER_BASE}/admin/shop/profile-reminder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ shopId }),
  });

  const data = await response.json().catch(() => ({})) as {
    ok?: boolean;
    error?: string;
    delivery_status?: string;
    missing?: string[];
  };

  if (!response.ok) {
    const friendly: Record<string,string> = {
      owner_missing: "ร้านนี้ยังไม่มีบัญชีเจ้าของร้าน จึงยังส่ง LINE ไม่ได้",
      line_not_linked: "บัญชีเจ้าของร้านยังไม่ได้ผูก LINE จึงยังส่งแจ้งเตือนไม่ได้",
    };
    const status = data.delivery_status ?? "";
    if (status.startsWith("line_failed_")) {
      throw new Error(`LINE ส่งข้อความไม่สำเร็จ (${status})`);
    }
    throw new Error(friendly[status] ?? data.error ?? "ส่งแจ้งเตือนไม่สำเร็จ");
  }

  return data;
}

export const SHOP_READINESS_LABELS: Record<string, string> = {
  name: "ชื่อร้าน",
  category: "หมวดร้าน",
  phone: "เบอร์โทรศัพท์",
  address: "ที่อยู่ร้าน",
  location: "ตำแหน่งร้านบนแผนที่",
  business_hours: "วันและเวลาทำการ",
  owner: "บัญชีเจ้าของร้าน",
  menu: "เมนูที่พร้อมขายอย่างน้อย 1 รายการ",
  verification_storefront: "รูปหน้าร้าน / หน้าบ้าน",
  verification_owner_selfie: "Selfie เจ้าของร้านกับสถานที่",
  verification_workspace: "รูปพื้นที่ประกอบกิจการภายใน",
  verification_review: "รอ Admin ตรวจหลักฐานยืนยันร้าน",
};
