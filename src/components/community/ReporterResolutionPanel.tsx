import { useEffect, useState } from "react";
import {
  getMyGoodDeedPoints,
  getReporterIncidentConversation,
  resolveReporterIncident,
  reviewIncidentResponder,
  type IncidentConversation,
} from "@/lib/communityEmergency";

type ReviewDraft = { rating: number; comment: string };

export function ReporterResolutionPanel({ incidentId }: { incidentId: string }) {
  const [conversation, setConversation] = useState<IncidentConversation | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewDraft>>({});
  const [thanksMyTree, setThanksMyTree] = useState(false);
  const [thanksMessage, setThanksMessage] = useState("");
  const [pointsTotal, setPointsTotal] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [thread, points] = await Promise.all([
        getReporterIncidentConversation(incidentId),
        getMyGoodDeedPoints(),
      ]);
      setConversation(thread);
      setPointsTotal(points.total);
      setThanksMyTree(thread.resolution?.thanks_mytree ?? false);
      setThanksMessage(thread.resolution?.thanks_message ?? "");
      setReviews(Object.fromEntries(thread.responders.map((responder) => [
        responder.responder_id,
        {
          rating: responder.review?.rating ?? 0,
          comment: responder.review?.comment ?? "",
        },
      ])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลจบเหตุไม่สำเร็จ");
    }
  }

  useEffect(() => {
    void load();
  }, [incidentId]);

  function updateReview(responderId: string, patch: Partial<ReviewDraft>) {
    setReviews((current) => ({
      ...current,
      [responderId]: {
        rating: current[responderId]?.rating ?? 0,
        comment: current[responderId]?.comment ?? "",
        ...patch,
      },
    }));
  }

  async function finishIncident() {
    setBusy(true);
    setError(null);
    setResultMessage(null);
    try {
      const resolution = await resolveReporterIncident(incidentId, thanksMyTree, thanksMessage);

      for (const responder of conversation?.responders ?? []) {
        const review = reviews[responder.responder_id];
        if (!review?.rating) continue;
        await reviewIncidentResponder(
          incidentId,
          responder.responder_id,
          review.rating,
          review.comment,
        );
      }

      setPointsTotal(resolution.good_deed_points_total);
      setResultMessage(
        resolution.good_deed_point_awarded
          ? "จบเหตุเรียบร้อย · ได้รับ +1 คะแนนความดี MyTree · รวม " + resolution.good_deed_points_total + " คะแนน"
          : resolution.good_deed_point_eligible
            ? "จบเหตุเรียบร้อย · คะแนนความดีของเหตุนี้ถูกบันทึกไว้แล้ว · รวม " + resolution.good_deed_points_total + " คะแนน"
            : "จบเหตุเรียบร้อย · เหตุนี้ยังไม่เข้าเงื่อนไขคะแนนความดี เพราะยังไม่มีผู้รับเรื่องหรือการยืนยันเหตุ",
      );
      setExpanded(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "จบเหตุไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const alreadyResolved = conversation?.status === "resolved" || conversation?.status === "closed";

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">MyTree Good Deed</p>
          <h2 className="mt-1 text-lg font-black">จบเหตุ & ขอบคุณผู้ช่วยเหลือ</h2>
          {pointsTotal !== null && <p className="mt-1 text-sm text-gray-600">คะแนนความดีสะสมของคุณ: <b>{pointsTotal}</b> คะแนน</p>}
        </div>
        {alreadyResolved && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">จบเหตุแล้ว</span>}
      </div>

      {!alreadyResolved && !expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-4 w-full rounded-2xl bg-emerald-700 px-4 py-4 font-black text-white">
          ✓ จบเหตุ / ได้รับการช่วยเหลือแล้ว
        </button>
      )}

      {(expanded || alreadyResolved) && (
        <div className="mt-4 space-y-4">
          {(conversation?.responders ?? []).length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-black">ให้คะแนนผู้ที่มาช่วย</p>
              {conversation!.responders.map((responder) => {
                const review = reviews[responder.responder_id] ?? { rating: 0, comment: "" };
                return (
                  <div key={responder.responder_id} className="rounded-2xl border p-3">
                    <p className="font-black">{responder.name}</p>
                    {responder.organization && <p className="text-xs text-gray-500">{responder.organization}</p>}
                    <div className="mt-2 flex gap-1" aria-label={"ให้คะแนน " + responder.name}>
                      {[1,2,3,4,5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => updateReview(responder.responder_id, { rating: star })}
                          className={"text-3xl " + (star <= review.rating ? "opacity-100" : "opacity-25")}
                          aria-label={star + " ดาว"}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={review.comment}
                      onChange={(e) => updateReview(responder.responder_id, { comment: e.target.value })}
                      rows={2}
                      placeholder="เขียน comment ถึงผู้ที่มาช่วย (ถ้ามี)"
                      className="mt-2 w-full rounded-xl border p-3 text-sm"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">ยังไม่มีผู้ช่วยที่กดรับเรื่อง จึงยังไม่มีรายชื่อสำหรับให้ดาว</p>
          )}

          <div className="rounded-2xl border border-[#b8d6aa] bg-[#f2f8ee] p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={thanksMyTree} onChange={(e) => setThanksMyTree(e.target.checked)} className="h-5 w-5" />
              <span className="font-black">🌳 ขอบคุณ MyTree</span>
            </label>
            <textarea
              value={thanksMessage}
              onChange={(e) => setThanksMessage(e.target.value)}
              rows={2}
              placeholder="ฝากข้อความถึง MyTree (ถ้ามี)"
              className="mt-3 w-full rounded-xl border bg-white p-3 text-sm"
            />
          </div>

          {!alreadyResolved && (
            <div>
              <p className="mb-2 text-xs leading-5 text-gray-500">เมื่อยืนยัน ระบบจะเปลี่ยนสถานะเป็น “จบเหตุแล้ว” และให้ 1 Good Deed Point สูงสุด 1 ครั้งต่อเหตุที่มีผู้ช่วยรับเรื่องหรือได้รับการยืนยันแล้ว</p>
              <button type="button" disabled={busy} onClick={() => void finishIncident()} className="w-full rounded-2xl bg-[#1f6a45] px-4 py-4 font-black text-white disabled:opacity-50">
                {busy ? "กำลังบันทึก…" : "ยืนยันจบเหตุ & บันทึกคำขอบคุณ"}
              </button>
              <button type="button" disabled={busy} onClick={() => setExpanded(false)} className="mt-2 w-full rounded-xl border px-4 py-3 text-sm font-bold">ยังไม่จบเหตุ</button>
            </div>
          )}
        </div>
      )}

      {resultMessage && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{resultMessage}</div>}
      {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </section>
  );
}
