import { getCurrentCustomerId, supabase, WORKER_BASE } from "@/lib/supabase";
import { shopStorageFolder, safeImageExtension } from "@/lib/storageKey";

export type ShopVerificationEvidenceKind = "storefront" | "owner_selfie" | "workspace";

export type ShopVerificationEvidence = {
  evidence_id: string;
  evidence_kind: ShopVerificationEvidenceKind;
  captured_at: string | null;
  capture_lat: number | null;
  capture_lng: number | null;
  created_at: string;
};

export type ShopVerificationState = {
  request_id: string;
  shop_id: string;
  status: "pending" | "in_review" | "approved" | "rejected" | "cancelled";
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
  evidence: ShopVerificationEvidence[];
};

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getMyShopVerification(shopId: string): Promise<ShopVerificationState> {
  const { data, error } = await supabase.rpc("fn_my_shop_verification_request", {
    p_shop_id: shopId,
  });
  check(error);
  return data as ShopVerificationState;
}

export async function uploadShopVerificationEvidence(args: {
  shopId: string;
  kind: ShopVerificationEvidenceKind;
  file: File;
  location?: { lat: number; lng: number } | null;
}) {
  const current = await getMyShopVerification(args.shopId);
  if (current.status === "approved") {
    throw new Error("ร้านนี้ผ่านการยืนยันแล้ว");
  }

  const customerId = await getCurrentCustomerId();
  if (!customerId) throw new Error("ไม่พบบัญชี MyTree ของเจ้าของร้าน");

  const ext = args.file.type === "image/heic"
    ? "heic"
    : args.file.type === "image/heif"
      ? "heif"
      : safeImageExtension(args.file.name, "jpg");

  const storagePath = [
    customerId,
    shopStorageFolder(args.shopId),
    current.request_id,
    `${args.kind}-${Date.now()}.${ext}`,
  ].join("/");

  const { error: uploadError } = await supabase.storage
    .from("shop-verification-evidence")
    .upload(storagePath, args.file, {
      contentType: args.file.type || "image/jpeg",
      upsert: false,
    });
  check(uploadError);

  const { data, error } = await supabase.rpc("fn_register_shop_verification_evidence", {
    p_request_id: current.request_id,
    p_shop_id: args.shopId,
    p_evidence_kind: args.kind,
    p_storage_bucket: "shop-verification-evidence",
    p_storage_path: storagePath,
    p_captured_at: new Date().toISOString(),
    p_capture_lat: args.location?.lat ?? null,
    p_capture_lng: args.location?.lng ?? null,
  });
  check(error);
  return data as string;
}

export type AdminShopVerification = {
  request_id: string | null;
  status: string;
  approved: boolean;
  requested_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  admin_note?: string | null;
  evidence_count: number;
  evidence_kinds: string[];
  evidence: ShopVerificationEvidence[];
};

export async function getAdminShopVerification(shopId: string): Promise<AdminShopVerification> {
  const { data, error } = await supabase.rpc("fn_admin_get_shop_verification", {
    p_shop_id: shopId,
  });
  check(error);
  return data as AdminShopVerification;
}

export async function reviewShopVerification(args: {
  requestId: string;
  decision: "approved" | "rejected";
  reason: string;
}) {
  const { error } = await supabase.rpc("fn_admin_review_shop_verification", {
    p_request_id: args.requestId,
    p_decision: args.decision,
    p_reason: args.reason,
  });
  check(error);
}

export async function getAdminVerificationEvidenceUrl(args: {
  evidenceId: string;
  reason: string;
}) {
  const token = await (await import("@/lib/supabase")).getAccessToken();
  if (!token) throw new Error("ไม่พบ Admin access token");

  const response = await fetch(`${WORKER_BASE}/admin/shop/verification-evidence-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      evidenceId: args.evidenceId,
      reason: args.reason,
    }),
  });

  const payload = await response.json().catch(() => ({})) as {
    url?: string;
    error?: string;
  };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "เปิดหลักฐานไม่สำเร็จ");
  }
  return payload.url;
}

export const VERIFICATION_LABELS: Record<ShopVerificationEvidenceKind, string> = {
  storefront: "รูปหน้าร้าน / หน้าบ้านที่ใช้ประกอบกิจการ",
  owner_selfie: "Selfie เจ้าของร้านกับสถานที่",
  workspace: "รูปพื้นที่ประกอบกิจการภายใน",
};
