import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMyShopVerification,
  uploadShopVerificationEvidence,
  VERIFICATION_LABELS,
  type ShopVerificationEvidenceKind,
  type ShopVerificationState,
} from "@/lib/shopVerification";

const REQUIRED: ShopVerificationEvidenceKind[] = ["storefront", "owner_selfie", "workspace"];

function getLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 60000 },
    );
  });
}

export function ShopVerificationPanel({ shopId, onChanged }: { shopId: string; onChanged?: () => void }) {
  const [state, setState] = useState<ShopVerificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<ShopVerificationEvidenceKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await getMyShopVerification(shopId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดสถานะการยืนยันร้านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploaded = useMemo(
    () => new Set((state?.evidence ?? []).map((item) => item.evidence_kind)),
    [state],
  );

  async function upload(kind: ShopVerificationEvidenceKind, file: File) {
    setUploading(kind);
    setError(null);
    setNotice(null);
    try {
      const location = await getLocation();
      await uploadShopVerificationEvidence({ shopId, kind, file, location });
      setNotice("บันทึกรูปยืนยันแล้ว");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดรูปยืนยันไม่สำเร็จ");
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return <section className="rounded-2xl border p-4 text-sm text-gray-500">กำลังโหลดการยืนยันร้าน...</section>;
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">📸 ยืนยันตัวตนและสถานที่ร้าน</h2>
        <p className="mt-1 text-sm text-gray-600">
          ต้องถ่ายรูปครบ 3 รายการและรอ Admin ตรวจสอบก่อนร้านจะผ่าน Readiness Gate
        </p>
      </div>

      <div className="rounded-xl bg-white/80 p-3 text-sm">
        <p className="font-medium">สถานะ: {state?.status ?? "pending"}</p>
        <p className="mt-1 text-xs text-gray-500">
          หลักฐาน {uploaded.size}/3 รูป
        </p>
        {state?.admin_note && (
          <p className="mt-2 text-xs text-red-600">หมายเหตุจาก Admin: {state.admin_note}</p>
        )}
      </div>

      <div className="space-y-3">
        {REQUIRED.map((kind) => {
          const complete = uploaded.has(kind);
          const selfie = kind === "owner_selfie";
          return (
            <div key={kind} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{VERIFICATION_LABELS[kind]}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {kind === "storefront"
                      ? "ให้เห็นหน้าร้าน หรือหน้าบ้าน/เลขที่บ้านกรณีทำขายที่บ้าน"
                      : kind === "owner_selfie"
                        ? "เจ้าของบัญชี MyTree ต้องอยู่ในภาพพร้อมร้าน/บ้านเดียวกัน"
                        : "ให้เห็นพื้นที่ทำอาหาร แพ็กสินค้า เคาน์เตอร์ หรือพื้นที่ทำงานจริง"}
                  </p>
                </div>
                <span className={complete ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-700"}>
                  {complete ? "ส่งแล้ว" : "ยังไม่มี"}
                </span>
              </div>

              {state?.status !== "approved" && (
                <label className="mt-3 block w-full cursor-pointer rounded-xl bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white">
                  {uploading === kind ? "กำลังอัปโหลด..." : complete ? "ถ่ายใหม่" : "ถ่ายรูป"}
                  <input
                    className="hidden"
                    type="file"
                    accept="image/*"
                    capture={selfie ? "user" : "environment"}
                    disabled={!!uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(kind, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {state?.status === "in_review" && (
        <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
          ส่งหลักฐานครบแล้ว กำลังรอ Admin ตรวจสอบ
        </div>
      )}
      {state?.status === "approved" && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          ผ่านการยืนยันตัวตนและสถานที่ร้านแล้ว
        </div>
      )}
      {state?.status === "rejected" && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          หลักฐานถูกปฏิเสธ กรุณาถ่ายและส่งใหม่ตามหมายเหตุของ Admin
        </div>
      )}

      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-[11px] leading-relaxed text-gray-500">
        รูปยืนยันทั้งหมดเป็นหลักฐานส่วนตัวสำหรับการตรวจสอบร้านเท่านั้น ไม่แสดงในหน้า Customer หรือแผนที่สาธารณะ
      </p>
    </section>
  );
}
