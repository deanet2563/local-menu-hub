import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { EmergencyNav } from "@/components/community/EmergencyNav";
import { listMyReportedIncidents, type MyReportedIncident } from "@/lib/communityEmergency";

const STATUS_LABEL: Record<string, string> = {
  reported: "รอรับเรื่อง",
  verifying: "กำลังตรวจสอบ",
  coordinating: "กำลังประสานงาน",
  "help-en-route": "ผู้ช่วยกำลังเดินทาง",
  assisted: "ได้รับการช่วยเหลือแล้ว",
  resolved: "จบเหตุแล้ว",
  closed: "ปิดเหตุ",
  duplicate: "เหตุซ้ำ",
  invalid: "ข้อมูลไม่ถูกต้อง",
};

const CATEGORY_LABEL: Record<string, string> = {
  medical: "ผู้ป่วย / บาดเจ็บ",
  flood: "น้ำท่วม",
  fire: "ไฟไหม้",
  accident: "อุบัติเหตุ",
  "road-obstruction": "ถนน / ทางผ่านไม่ได้",
  "utility-infrastructure": "ไฟฟ้า / สิ่งกีดขวาง",
  "missing-person": "บุคคลสูญหาย",
  "evacuation-rescue": "อพยพ / กู้ภัย",
  supplies: "สิ่งของจำเป็น",
  other: "เหตุอื่น",
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return \`\${minutes} นาทีที่แล้ว\`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return \`\${hours} ชม.ที่แล้ว\`;
  return \`\${Math.round(hours / 24)} วันที่แล้ว\`;
}

function IncidentRow({ item }: { item: MyReportedIncident }) {
  return (
    <Link
      to="/community/my-incidents/$incidentId"
      params={{ incidentId: item.incident_id }}
      className="block rounded-2xl border bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#b42318]">{CATEGORY_LABEL[item.category] ?? item.category}</p>
          <h3 className="mt-1 font-black">{item.community_name}</h3>
        </div>
        <span className="text-xs text-gray-500">{relativeTime(item.updated_at)}</span>
      </div>

      {item.description && <p className="mt-2 line-clamp-2 text-sm text-gray-700">{item.description}</p>}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold">{STATUS_LABEL[item.status] ?? item.status}</span>
        {item.responder_count > 0 && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            ผู้ช่วย {item.responder_count} คน
          </span>
        )}
        {item.message_count > 0 && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
            ข้อความ {item.message_count}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>แจ้งเมื่อ {new Date(item.created_at).toLocaleString("th-TH")}</span>
        <span className="font-black text-[#1f6a45]">เปิดรายละเอียด ›</span>
      </div>
    </Link>
  );
}

export function MyReportedIncidents() {
  const [items, setItems] = useState<MyReportedIncident[]>([]);
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await listMyReportedIncidents());
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดเหตุการณ์ของฉันไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "resolved") return items.filter((item) => item.status === "resolved" || item.status === "closed");
    return items.filter((item) => !["resolved", "closed", "duplicate", "invalid"].includes(item.status));
  }, [filter, items]);

  return (
    <main className="min-h-dvh bg-[#f8fbf5] pb-24 text-[#173c29]">
      <EmergencyNav />

      <header className="border-b bg-white px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-black uppercase tracking-wide text-[#b42318]">MyTree Emergency</p>
          <h1 className="mt-1 text-2xl font-black">เหตุการณ์ที่ฉันแจ้ง</h1>
          <p className="mt-2 text-sm text-gray-600">
            ดูสถานะ ผู้ที่รับเรื่อง ข้อความ และกลับเข้า Incident Thread เดิมได้จากที่นี่
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-sm">
          {([
            ["active", "กำลังดำเนินการ"],
            ["resolved", "จบเหตุแล้ว"],
            ["all", "ทั้งหมด"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                "rounded-xl px-3 py-2 text-xs font-black " +
                (filter === key ? "bg-[#1f6a45] text-white" : "text-gray-600")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">{visible.length} รายการ</p>
          <button type="button" onClick={() => void load()} className="rounded-xl border bg-white px-3 py-2 text-xs font-black">
            รีเฟรช
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm shadow-sm">กำลังโหลด…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-800">
              ลองใหม่
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="font-black">ยังไม่มีเหตุในหมวดนี้</p>
            <Link to="/community/report" className="mt-3 inline-block rounded-xl bg-[#b42318] px-4 py-3 text-sm font-black text-white">
              แจ้งเหตุ / ขอความช่วยเหลือ
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((item) => <IncidentRow key={item.incident_id} item={item} />)}
          </div>
        )}
      </div>
    </main>
  );
}
