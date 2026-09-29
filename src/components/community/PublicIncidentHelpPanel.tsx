import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  acceptPublicIncident,
  getMyEmergencyProfile,
  getPublicIncidentHelpState,
  getResponderIncidentDashboard,
  type PublicIncidentDetail,
  type PublicIncidentHelpState,
  type SharedIncidentPayload,
} from "@/lib/communityEmergency";
import { IncidentConversationPanel } from "@/components/community/IncidentConversationPanel";

function friendlyHelpError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("reporter_cannot_accept_own_incident") || message.includes("reporter cannot accept own incident")) {
    return "ผู้แจ้งไม่สามารถกดรับเรื่องของตัวเองได้";
  }
  if (message.includes("responder_name_required")) return "กรุณากรอกชื่อผู้ช่วย";
  if (message.includes("responder_phone_required")) return "กรุณากรอกเบอร์โทรกลับ";
  if (message.includes("invalid_responder_phone")) return "รูปแบบเบอร์โทรกลับไม่ถูกต้อง";
  if (message.includes("incident not available for response")) return "เหตุนี้ไม่เปิดรับผู้ช่วยเพิ่มเติมแล้ว";
  return message || "รับเรื่องไม่สำเร็จ";
}

export function PublicIncidentHelpPanel({
  detail,
}: {
  detail: PublicIncidentDetail;
}) {
  const incident = detail.incident;
  const [state, setState] = useState<PublicIncidentHelpState | null>(null);
  const [privateDashboard, setPrivateDashboard] = useState<SharedIncidentPayload | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approximateDirections = useMemo(() => {
    if (incident.public_lat === null || incident.public_lng === null) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${incident.public_lat},${incident.public_lng}`;
  }, [incident.public_lat, incident.public_lng]);

  async function loadState() {
    try {
      const next = await getPublicIncidentHelpState(incident.incident_id);
      setState(next);

      if (next.viewer_responder) {
        try {
          setPrivateDashboard(await getResponderIncidentDashboard(incident.incident_id));
        } catch {
          setPrivateDashboard(null);
        }
      } else {
        setPrivateDashboard(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตรวจสิทธิ์ช่วยเหลือไม่สำเร็จ");
    }
  }

  useEffect(() => {
    void Promise.all([
      loadState(),
      getMyEmergencyProfile()
        .then((profile) => {
          setName(profile.name ?? "");
          setPhone(profile.phone ?? "");
        })
        .catch(() => undefined),
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.incident_id]);

  async function accept() {
    if (!name.trim() || !phone.trim()) {
      setError("กรุณากรอกชื่อและเบอร์โทรกลับ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await acceptPublicIncident(
        incident.incident_id,
        name,
        phone,
        organization,
        message || "รับเรื่องแล้ว กำลังเข้าไปช่วยเหลือ",
      );
      setMessage("");
      await loadState();
    } catch (e) {
      setError(friendlyHelpError(e));
    } finally {
      setBusy(false);
    }
  }

  const exactIncident = privateDashboard?.incident;
  const exactDirections = exactIncident
    ? `https://www.google.com/maps/dir/?api=1&destination=${exactIncident.exact_lat},${exactIncident.exact_lng}`
    : null;

  if (!state) {
    return (
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">กำลังเตรียมปุ่มช่วยเหลือ…</p>
        {approximateDirections && (
          <a
            href={approximateDirections}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-xl border px-4 py-3 text-center text-sm font-black"
          >
            🧭 นำทางไปพื้นที่โดยประมาณ
          </a>
        )}
      </section>
    );
  }

  if (state.viewer_is_reporter) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="font-black text-amber-900">นี่คือเหตุที่คุณแจ้ง</h2>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          ผู้แจ้งไม่สามารถรับเรื่องของตัวเองได้ แต่สามารถเปิดสถานะและข้อความของเหตุนี้ได้
        </p>
        <Link
          to="/community/my-incidents/$incidentId"
          params={{ incidentId: incident.incident_id }}
          className="mt-3 block rounded-xl bg-amber-900 px-4 py-3 text-center text-sm font-black text-white"
        >
          เปิดสถานะเหตุของฉัน
        </Link>
      </section>
    );
  }

  if (state.viewer_responder) {
    return (
      <div className="space-y-4">
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">คุณรับเรื่องนี้แล้ว</p>
          <h2 className="mt-1 text-lg font-black text-emerald-900">
            {state.viewer_responder.name}
          </h2>
          {state.viewer_responder.organization && (
            <p className="mt-1 text-sm text-emerald-800">{state.viewer_responder.organization}</p>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {exactDirections ? (
              <a
                href={exactDirections}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[#1f6a45] px-4 py-3 text-center font-black text-white"
              >
                🧭 นำทางไปจุดเกิดเหตุจริง
              </a>
            ) : approximateDirections ? (
              <a
                href={approximateDirections}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[#1f6a45] px-4 py-3 text-center font-black text-white"
              >
                🧭 นำทางไปพื้นที่โดยประมาณ
              </a>
            ) : null}

            {privateDashboard?.contact.phone && (
              <a
                href={`tel:${privateDashboard.contact.phone}`}
                className="rounded-xl bg-[#b42318] px-4 py-3 text-center font-black text-white"
              >
                ☎️ โทรผู้แจ้ง {privateDashboard.contact.phone}
              </a>
            )}
          </div>

          {privateDashboard?.contact.address && (
            <div className="mt-3 rounded-xl bg-white p-3 text-sm">
              <p className="text-xs font-bold text-gray-500">ที่อยู่ / จุดสังเกตที่ผู้แจ้งให้ไว้</p>
              <p className="mt-1 font-semibold">{privateDashboard.contact.address}</p>
            </div>
          )}
        </section>

        <IncidentConversationPanel
          mode={{ kind: "accepted-responder", incidentId: incident.incident_id }}
        />
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-red-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#b42318]">Help this incident</p>
      <h2 className="mt-1 text-xl font-black">ฉันจะเข้าไปช่วย</h2>
      <p className="mt-1 text-sm leading-6 text-gray-600">
        คนใกล้เคียง อาสาสมัคร หรือมูลนิธิสามารถรับเรื่องได้จากหน้านี้โดยตรง
        ชื่อและเบอร์โทรกลับเป็นข้อมูลบังคับเพื่อให้ผู้แจ้งติดต่อกลับได้
      </p>

      {approximateDirections && (
        <a
          href={approximateDirections}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block rounded-xl border border-[#1f6a45] px-4 py-3 text-center text-sm font-black text-[#1f6a45]"
        >
          🧭 ดูเส้นทางไปพื้นที่โดยประมาณก่อนรับเรื่อง
        </a>
      )}

      <div className="mt-4 grid gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อผู้ช่วย / ชื่อผู้รับเรื่อง"
          className="rounded-xl border p-3 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="เบอร์โทรกลับ"
          className="rounded-xl border p-3 text-sm"
        />
        <input
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="มูลนิธิ / หน่วยงาน / กลุ่ม (ถ้ามี)"
          className="rounded-xl border p-3 text-sm"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="ข้อความถึงผู้แจ้ง เช่น ผมอยู่ใกล้พื้นที่ กำลังเดินทางไปช่วย ประมาณ 10 นาทีถึง"
          className="rounded-xl border p-3 text-sm"
        />
      </div>

      <button
        type="button"
        disabled={busy || !name.trim() || !phone.trim()}
        onClick={() => void accept()}
        className="mt-3 w-full rounded-2xl bg-[#b42318] px-4 py-4 font-black text-white disabled:opacity-40"
      >
        {busy ? "กำลังรับเรื่อง…" : "🤝 รับช่วยเหลือและส่งข้อความถึงผู้แจ้ง"}
      </button>

      <p className="mt-2 text-xs leading-5 text-gray-500">
        หลังรับเรื่อง ระบบจะเปิดข้อมูลช่วยเหลือที่จำเป็นให้ผู้ช่วยที่ยืนยันตัวตนแล้ว
        และผู้แจ้งจะได้รับ LINE แจ้งชื่อ เบอร์โทร และข้อความของคุณ
      </p>

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
    </section>
  );
}
