import { getAccessToken, supabase, SUPABASE_URL } from "@/lib/supabase";

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
  if (args.file.size <= 0) throw new Error("ไม่พบข้อมูลรูปภาพ");
  if (args.file.size > 10 * 1024 * 1024) {
    throw new Error("รูปมีขนาดใหญ่เกิน 10 MB กรุณาถ่ายใหม่หรือใช้รูปขนาดเล็กลง");
  }

  const token = await getAccessToken();
  if (!token) throw new Error("ไม่พบ MyTree access token");

  const form = new FormData();
  form.append("shopId", args.shopId);
  form.append("kind", args.kind);
  form.append("file", args.file, args.file.name || `${args.kind}.jpg`);
  if (args.location) {
    form.append("lat", String(args.location.lat));
    form.append("lng", String(args.location.lng));
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/shop-verification-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({})) as {
      ok?: boolean;
      error?: string;
      evidence_id?: string;
    };

    if (!response.ok || !payload.ok) {
      const friendly: Record<string, string> = {
        authentication_required: "กรุณาเข้าสู่ระบบ LINE ใหม่",
        customer_identity_missing: "ไม่พบบัญชี MyTree ของเจ้าของร้าน",
        invalid_shop_or_kind: "ข้อมูลร้านหรือประเภทรูปไม่ถูกต้อง",
        image_required: "กรุณาถ่ายหรือเลือกรูปก่อนอัปโหลด",
        unsupported_image_type: "ไฟล์รูปประเภทนี้ยังไม่รองรับ กรุณาใช้ JPEG, PNG, WEBP หรือ HEIC",
        image_size_invalid: "รูปมีขนาดใหญ่เกิน 10 MB",
        verification_request_failed: "ไม่สามารถเปิดคำขอยืนยันร้านได้",
        verification_already_approved: "ร้านนี้ผ่านการยืนยันแล้ว",
        storage_upload_failed: "อัปโหลดรูปไปยังพื้นที่จัดเก็บไม่สำเร็จ",
        evidence_register_failed: "อัปโหลดรูปแล้วแต่บันทึกหลักฐานไม่สำเร็จ",
      };
      throw new Error(friendly[payload.error ?? ""] ?? payload.error ?? "อัปโหลดรูปยืนยันไม่สำเร็จ");
    }

    return payload.evidence_id ?? "";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("อัปโหลดใช้เวลานานเกิน 45 วินาที กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
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
  const { data, error } = await supabase.functions.invoke(
    "shop-verification-evidence-url",
    {
      body: {
        evidenceId: args.evidenceId,
        reason: args.reason,
      },
    },
  );

  if (error) throw new Error(error.message || "เปิดหลักฐานไม่สำเร็จ");
  const payload = data as { url?: string; error?: string } | null;
  if (!payload?.url) {
    throw new Error(payload?.error ?? "เปิดหลักฐานไม่สำเร็จ");
  }
  return payload.url;
}

export const VERIFICATION_LABELS: Record<ShopVerificationEvidenceKind, string> = {
  storefront: "รูปหน้าร้าน / หน้าบ้านที่ใช้ประกอบกิจการ",
  owner_selfie: "Selfie เจ้าของร้านกับสถานที่",
  workspace: "รูปพื้นที่ประกอบกิจการภายใน",
};
