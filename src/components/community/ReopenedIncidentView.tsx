import { useEffect, useState } from "react";
import {
  getPrivateIncidentEvidenceUrl,
  getReporterIncidentDashboard,
  getResponderIncidentDashboard,
  type SharedIncidentPayload,
} from "@/lib/communityEmergency";
import { IncidentConversationPanel } from "@/components/community/IncidentConversationPanel";
import { ReporterResolutionPanel } from "@/components/community/ReporterResolutionPanel";
import { Link } from "@tanstack/react-router";

export function ReopenedIncidentView({
  role,
  incidentId,
}: {
  role: "reporter" | "responder";
  incidentId: string;
}) {
  const [data, setData] = useState<SharedIncidentPayload | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = role === "reporter" ? getReporterIncidentDashboard : getResponderIncidentDashboard;
    void load(incidentId)
      .then(async (payload) => {
        if (cancelled) return;
        setData(payload);
        const pairs = await Promise.all(
          payload.evidence.map(async (item) => {
            try {
              const url = await getPrivateIncidentEvidenceUrl(role, incidentId, item.evidence_id);
              return [item.evidence_id, url] as const;
            } catch {
              return [item.evidence_id, ""] as const;
            }
          }),
        );
        if (!cancelled) setImages(Object.fromEntries(pairs.filter(([, url]) => url)));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "เปิดข้อมูลเหตุไม่สำเร็จ"));
    return () => { cancelled = true; };
  }, [incidentId, role]);

  if (error) {
    return <main className="min-h-dvh bg-[#f8fbf5] p-5"><div className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow"><h1 className="text-xl font-black text-red-800">เปิดข้อมูลเหตุไม่ได้</h1><p className="mt-2 text-sm text-gray-600">{error}</p></div></main>;
  }

  if (!data) {
    return <main className="min-h-dvh bg-[#f8fbf5] p-5"><div className="mx-auto max-w-lg rounded-3xl bg-white p-6 text-center shadow">กำลังโหลดข้อมูลเหตุ…</div></main>;
  }

  const { incident, contact } = data;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${incident.exact_lat},${incident.exact_lng}`;

  return (
    <main className="min-h-dvh bg-[#f8fbf5] pb-10 text-[#173c29]">
      <header className="bg-[#b42318] px-5 py-5 text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-bold">{role === "reporter" ? "MYTREE EMERGENCY — MY INCIDENT" : "MYTREE EMERGENCY — RESPONDING"}</p>
          <h1 className="mt-1 text-2xl font-black">{role === "reporter" ? "สถานะเหตุของฉัน" : "เหตุที่ฉันรับช่วยเหลือ"}</h1>
          <p className="mt-2 text-sm text-white/90">เลขอ้างอิง {incident.incident_id.slice(0, 8).toUpperCase()}</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-red-700">เหตุการณ์</p>
          <h2 className="mt-1 text-xl font-black">{incident.category}</h2>
          <p className="mt-2 text-sm">{incident.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2 py-1">{incident.status}</span>
            <span className="rounded-full bg-amber-50 px-2 py-1">ถนน: {incident.road_impact}</span>
            {incident.need_tags.map((tag) => <span key={tag} className="rounded-full bg-[#eef7e9] px-2 py-1">{tag}</span>)}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">ผู้แจ้ง & สถานที่</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-xs text-gray-500">ชื่อผู้แจ้ง</dt><dd className="font-semibold">{contact.name || "ไม่ได้ระบุ"}</dd></div>
            <div><dt className="text-xs text-gray-500">ที่อยู่ / จุดสังเกต</dt><dd>{contact.address || incident.detected_area_label || "ไม่ได้ระบุ"}</dd></div>
            <div><dt className="text-xs text-gray-500">พื้นที่ MyTree</dt><dd>{data.community?.name || incident.detected_area_label || "นอกพื้นที่ชุมชน MyTree"}</dd></div>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {contact.phone ? (
              <a href={`tel:${contact.phone}`} className="rounded-xl bg-[#b42318] px-3 py-3 text-center font-black text-white">
                {role === "responder" ? `โทรผู้แจ้ง ${contact.phone}` : `เบอร์ที่แจ้งไว้ ${contact.phone}`}
              </a>
            ) : (
              <div className="rounded-xl bg-gray-100 px-3 py-3 text-center text-sm text-gray-500">ไม่มีเบอร์โทร</div>
            )}
            <a href={directions} target="_blank" rel="noreferrer" className="rounded-xl bg-[#1f6a45] px-3 py-3 text-center font-black text-white">
              นำทางไปจุดเกิดเหตุ
            </a>
          </div>

          {contact.submitted_map_url && (
            <a href={contact.submitted_map_url} target="_blank" rel="noreferrer" className="mt-2 block w-full rounded-xl border px-3 py-2 text-center text-sm font-semibold">
              เปิด Google Maps link ที่ผู้แจ้งส่งมา
            </a>
          )}
        </section>

        {data.evidence.length > 0 && (
          <section className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="font-black">รูป / หลักฐาน</h2>
            <div className="mt-3 grid gap-3">
              {data.evidence.map((item) => images[item.evidence_id] ? (
                <img key={item.evidence_id} src={images[item.evidence_id]} alt="หลักฐานเหตุการณ์" className="max-h-96 w-full rounded-2xl object-cover" />
              ) : (
                <div key={item.evidence_id} className="rounded-xl bg-gray-100 p-4 text-center text-sm text-gray-500">กำลังโหลดรูป…</div>
              ))}
            </div>
          </section>
        )}

        <IncidentConversationPanel
          mode={role === "reporter"
            ? { kind: "reporter", incidentId }
            : { kind: "accepted-responder", incidentId }}
        />

        {role === "reporter" && <ReporterResolutionPanel incidentId={incidentId} />}

        <Link to="/community/incidents" className="block rounded-2xl border bg-white px-4 py-3 text-center text-sm font-black shadow-sm">
          ดูเหตุการณ์ทั้งหมด / Incident List
        </Link>

        <p className="px-2 text-xs leading-5 text-gray-500">
          ข้อมูลหน้านี้เป็นข้อมูลจำกัดสิทธิ์สำหรับผู้แจ้งหรือผู้ช่วยที่รับเรื่องแล้วเท่านั้น
        </p>
      </div>
    </main>
  );
}
