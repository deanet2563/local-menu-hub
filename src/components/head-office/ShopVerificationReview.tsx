import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdminShopVerification,
  getAdminVerificationEvidenceUrl,
  reviewShopVerification,
  VERIFICATION_LABELS,
  type AdminShopVerification,
  type ShopVerificationEvidenceKind,
} from "@/lib/shopVerification";

const ORDER: ShopVerificationEvidenceKind[] = ["storefront", "owner_selfie", "workspace"];

export function ShopVerificationReview({
  shopId,
  canAction,
  onChanged,
}: {
  shopId: string;
  canAction: boolean;
  onChanged: () => void;
}) {
  const [state, setState] = useState<AdminShopVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageTitle, setImageTitle] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await getAdminShopVerification(shopId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลยืนยันร้านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byKind = useMemo(() => {
    const map = new Map<string, NonNullable<AdminShopVerification["evidence"]>[number]>();
    for (const item of state?.evidence ?? []) map.set(item.evidence_kind, item);
    return map;
  }, [state]);

  async function viewEvidence(kind: ShopVerificationEvidenceKind) {
    const evidence = byKind.get(kind);
    if (!evidence) return;
    setBusy(true);
    setError(null);
    try {
      const url = await getAdminVerificationEvidenceUrl({
        evidenceId: evidence.evidence_id,
        reason: "ตรวจหลักฐานยืนยันร้านใน Head Office",
      });
      setImageTitle(VERIFICATION_LABELS[kind]);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดหลักฐานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function openDecision(next: "approved" | "rejected") {
    setDecision(next);
    setReason(
      next === "approved"
        ? "หลักฐานทั้ง 3 รูปชัดเจนและตรงกับข้อมูลร้าน"
        : "หลักฐานยังไม่ชัดเจนหรือไม่ตรงกับข้อมูลร้าน",
    );
  }

  async function submitDecision() {
    if (!decision || !state?.request_id) return;
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผล");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reviewShopVerification({
        requestId: state.request_id,
        decision,
        reason: reason.trim(),
      });
      setDecision(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกผลตรวจสอบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <section className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">กำลังโหลดการยืนยันร้าน...</section>;
  }

  const status = state?.status ?? "not_started";
  const complete = (state?.evidence_count ?? 0) === 3;

  return (
    <>
      <section className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-gray-900">การยืนยันร้านค้า</h4>
            <p className="mt-1 text-xs text-gray-500">
              หลักฐานส่วนตัวสำหรับ Admin เท่านั้น ไม่แสดงหน้า Customer
            </p>
          </div>
          <span className={
            status === "approved"
              ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
              : status === "rejected"
                ? "rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"
                : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
          }>
            {status === "approved" ? "Verified" : status === "in_review" ? "รอตรวจ" : status === "rejected" ? "Rejected" : "รอรูป"}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {ORDER.map((kind) => {
            const evidence = byKind.get(kind);
            return (
              <div key={kind} className="rounded-xl border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{VERIFICATION_LABELS[kind]}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {evidence
                        ? `ส่งแล้ว · ${evidence.captured_at ? new Date(evidence.captured_at).toLocaleString("th-TH") : "ไม่ระบุเวลาถ่าย"}`
                        : "ยังไม่ได้ส่ง"}
                    </p>
                  </div>
                  {evidence && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void viewEvidence(kind)}
                      className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold text-gray-900 disabled:opacity-50"
                    >
                      ดูรูป
                    </button>
                  )}
                </div>
                {evidence?.capture_lat != null && evidence.capture_lng != null && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    พิกัดตอนส่งรูป: {evidence.capture_lat}, {evidence.capture_lng}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-gray-500">หลักฐานครบ {state?.evidence_count ?? 0}/3 รูป</p>
        {state?.admin_note && <p className="mt-2 text-xs text-gray-500">หมายเหตุ: {state.admin_note}</p>}

        {canAction && status === "in_review" && complete && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => openDecision("rejected")}
              className="rounded-xl border border-red-300 px-3 py-2.5 font-semibold text-red-700"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openDecision("approved")}
              className="rounded-xl bg-emerald-600 px-3 py-2.5 font-semibold text-white"
            >
              Verify ผ่าน
            </button>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      </section>

      {imageUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{imageTitle}</p>
              <button type="button" onClick={() => setImageUrl(null)} className="rounded-lg border px-3 py-1.5 text-sm">ปิด</button>
            </div>
            <img src={imageUrl} alt={imageTitle} className="w-full rounded-xl object-contain" />
            <p className="mt-2 text-[11px] text-gray-400">Signed URL มีอายุประมาณ 5 นาที</p>
          </div>
        </div>
      )}

      {decision && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold">
              {decision === "approved" ? "ยืนยันหลักฐานร้านค้า" : "ปฏิเสธหลักฐานร้านค้า"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">เหตุผลนี้จะถูกบันทึกใน Audit history</p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="mt-4 w-full rounded-xl border p-3 text-sm"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDecision(null)} className="rounded-xl border px-4 py-3 text-sm font-semibold">
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitDecision()}
                className={decision === "approved"
                  ? "rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  : "rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"}
              >
                {busy ? "กำลังบันทึก..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
