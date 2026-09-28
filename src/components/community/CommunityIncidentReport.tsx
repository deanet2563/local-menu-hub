import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCommunityIncident,
  getEmergencyReportingAccess,
  recommendEmergencyContacts,
  resolveEmergencyArea,
  uploadIncidentEvidence,
  type EmergencyAreaResolution,
  type EmergencyContact,
  type EmergencyReportingAccess,
  type IncidentCategory,
  type RoadImpact,
} from "@/lib/communityEmergency";

const CATEGORIES: Array<{ key: IncidentCategory; icon: string; label: string }> = [
  { key: "medical", icon: "🩺", label: "ผู้ป่วย / บาดเจ็บ" },
  { key: "flood", icon: "🌊", label: "น้ำท่วม" },
  { key: "fire", icon: "🔥", label: "ไฟไหม้" },
  { key: "accident", icon: "🚑", label: "อุบัติเหตุ" },
  { key: "road-obstruction", icon: "⛔", label: "ถนน / ทางผ่านไม่ได้" },
  { key: "utility-infrastructure", icon: "⚡", label: "ไฟฟ้า / สิ่งกีดขวาง" },
  { key: "missing-person", icon: "🔎", label: "บุคคลสูญหาย" },
  { key: "evacuation-rescue", icon: "🛟", label: "ต้องการอพยพ / ช่วยเหลือ" },
  { key: "supplies", icon: "📦", label: "ต้องการสิ่งของจำเป็น" },
  { key: "other", icon: "⚠️", label: "เหตุอื่น" },
];

const NEEDS = [
  ["medical-help", "ความช่วยเหลือทางการแพทย์"],
  ["rescue", "กู้ภัย"],
  ["evacuation", "อพยพ"],
  ["transport", "รถ / การเดินทาง"],
  ["food", "อาหาร"],
  ["drinking-water", "น้ำดื่ม"],
  ["medicine", "ยา"],
  ["power", "ไฟฟ้า / ชาร์จแบต"],
  ["shelter", "ที่พัก"],
  ["volunteers", "อาสาสมัคร"],
] as const;

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("emergency reporting restricted")) return "บัญชีนี้ถูกจำกัดสิทธิ์การแจ้งเหตุฉุกเฉิน กรุณาติดต่อผู้ดูแลหากต้องการตรวจสอบ";
  if (message.includes("emergency reporting rate limit")) return "มีการส่งแจ้งเหตุถี่เกินไป ระบบพักการส่งชั่วคราวเพื่อป้องกันสแปม";
  if (message.includes("authentication required")) return "กรุณาเข้าสู่ระบบด้วย LINE ก่อนส่งแจ้งเหตุ";
  return message || "ส่งรายงานไม่สำเร็จ";
}

export function CommunityIncidentReport() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<IncidentCategory | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [roadImpact, setRoadImpact] = useState<RoadImpact>("unknown");
  const [description, setDescription] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState<EmergencyAreaResolution | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [reportingAccess, setReportingAccess] = useState<EmergencyReportingAccess | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoLocateStarted = useRef(false);

  useEffect(() => {
    if (!photo) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    void getEmergencyReportingAccess()
      .then(setReportingAccess)
      .catch(() => setReportingAccess({ allowed: true }));
  }, []);

  useEffect(() => {
    if (autoLocateStarted.current) return;
    autoLocateStarted.current = true;
    locate();
  }, []);

  useEffect(() => {
    if (!category || needs.length === 0) {
      setContacts([]);
      return;
    }
    setContactsLoading(true);
    void recommendEmergencyContacts(category, needs, area)
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setContactsLoading(false));
  }, [category, needs, area]);

  const callScript = useMemo(() => {
    if (!category || needs.length === 0) return "";
    const categoryLabel = CATEGORIES.find((item) => item.key === category)?.label ?? "เหตุฉุกเฉิน";
    const selectedNeeds = NEEDS.filter(([key]) => needs.includes(key)).map(([, label]) => label);
    const areaLabel = area?.area_label || "ตำแหน่งปัจจุบัน";
    return `แจ้งเหตุ ${categoryLabel} ที่ ${areaLabel} ต้องการ ${selectedNeeds.join(" / ")} ขณะนี้มีตำแหน่ง GPS ของผู้แจ้งพร้อมใช้งาน`;
  }, [category, needs, area]);

  function locate() {
    if (!navigator.geolocation) {
      setError("อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPoint = { lat: position.coords.latitude, lng: position.coords.longitude };
        setPoint(nextPoint);
        void resolveEmergencyArea(nextPoint.lat, nextPoint.lng)
          .then(setArea)
          .catch(() => setArea({
            community_id: null,
            community_name: null,
            area_label: "นอกพื้นที่ชุมชน MyTree",
            province: null,
            district: null,
            distance_m: null,
            resolution_method: "outside-coverage",
            inside_coverage: false,
          }))
          .finally(() => setLocating(false));
      },
      () => {
        setError("อ่านตำแหน่งไม่สำเร็จ กรุณาอนุญาตตำแหน่งแล้วลองอีกครั้ง");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function toggleNeed(key: string) {
    setNeeds((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  async function submit() {
    if (!category || !point) {
      setError("กรุณาระบุประเภทเหตุและตำแหน่ง");
      return;
    }
    if (reportingAccess && !reportingAccess.allowed) {
      setError("บัญชีนี้ถูกจำกัดสิทธิ์การแจ้งเหตุฉุกเฉิน");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const id = await createCommunityIncident({
        communityId: area?.community_id ?? null,
        category,
        severity: "unknown",
        description,
        needTags: needs,
        roadImpact,
        exactLat: point.lat,
        exactLng: point.lng,
        publicLat: Number(point.lat.toFixed(3)),
        publicLng: Number(point.lng.toFixed(3)),
        publicLocationPrecision: "block",
      });
      if (photo) await uploadIncidentEvidence(id, photo);
      setResult(id);
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="min-h-dvh bg-[#f8fbf5] p-5 text-[#173c29]">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow">
          <div className="text-5xl">✓</div>
          <h1 className="mt-4 text-2xl font-black">รับแจ้งเหตุแล้ว</h1>
          <p className="mt-2 text-sm text-gray-600">เลขอ้างอิง {result}</p>
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            หากมีอันตรายต่อชีวิต โปรดติดต่อหน่วยฉุกเฉินโดยตรง อย่ารอการตอบกลับจาก MyTree
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f8fbf5] pb-28 text-[#173c29]">
      <header className="bg-[#b42318] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-sm font-bold">MyTree Community</p>
          <h1 className="mt-1 text-2xl font-black">แจ้งเหตุ / ขอความช่วยเหลือ</h1>
          <p className="mt-2 text-sm text-white/90">ระบบตรวจพื้นที่จากตำแหน่งโดยอัตโนมัติ ผู้พบเหตุแจ้งได้แม้ไม่ได้เป็นสมาชิกชุมชนนั้น</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <aside className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-black text-red-800">อันตรายต่อชีวิตหรือเหตุฉุกเฉินทันที?</p>
          <p className="mt-1 text-sm text-red-700">เลือกประเภทเหตุและสิ่งที่ต้องการ ระบบจะแสดงเบอร์ฉุกเฉินที่ผ่านการตรวจสอบให้โทรได้ทันที</p>
        </aside>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">1. จุดเกิดเหตุ</h2>
          <button type="button" onClick={locate} disabled={locating} className="mt-3 w-full rounded-2xl bg-[#1f6a45] px-4 py-4 font-bold text-white disabled:opacity-70">
            {locating ? "กำลังตรวจตำแหน่งและพื้นที่…" : point ? "✓ ตรวจพบตำแหน่งแล้ว · ตรวจใหม่" : "📍 ใช้ตำแหน่งปัจจุบัน"}
          </button>

          {point && (
            <div className="mt-3 rounded-2xl bg-[#eef7e9] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#1f6a45]">Auto-detected area</p>
              <p className="mt-1 font-black">{area?.area_label ?? "กำลังตรวจพื้นที่…"}</p>
              {area?.inside_coverage ? (
                <p className="mt-1 text-xs text-gray-600">เหตุจะผูกกับพื้นที่นี้อัตโนมัติ ไม่ต้องเป็นสมาชิกชุมชน</p>
              ) : (
                <p className="mt-1 text-xs text-amber-700">อยู่นอกพื้นที่ชุมชน MyTree ก็ยังสามารถแจ้งเหตุได้</p>
              )}
            </div>
          )}

          {point && <p className="mt-2 text-xs text-gray-500">พิกัดละเอียดเป็นข้อมูลจำกัดสิทธิ์ แผนที่สาธารณะใช้ตำแหน่งโดยประมาณ</p>}
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">2. เกิดเหตุอะไร?</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCategory(item.key)}
                className={`min-h-20 rounded-2xl border p-3 text-left text-sm font-bold ${category === item.key ? "border-[#b42318] bg-red-50" : "border-gray-200"}`}
              >
                <span className="mr-2 text-xl">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">3. ต้องการอะไร?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEEDS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleNeed(key)}
                className={`rounded-full border px-3 py-2 text-sm font-semibold ${needs.includes(key) ? "border-[#1f6a45] bg-[#eef7e9] text-[#1f6a45]" : "border-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {category && needs.length > 0 && (
            <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-3">
              <p className="font-black text-red-800">☎️ ติดต่อฉุกเฉินทันที</p>
              <p className="mt-1 text-xs text-red-700">MyTree เลือกจากทะเบียนเบอร์ที่ตรวจสอบแล้วตามประเภทเหตุและพื้นที่ ไม่สร้างหมายเลขขึ้นเอง</p>
              {contactsLoading && <p className="mt-3 text-sm text-gray-600">กำลังเตรียมเบอร์ติดต่อ…</p>}
              {!contactsLoading && contacts.length === 0 && <p className="mt-3 text-sm text-gray-600">ยังไม่พบเบอร์ที่ตรงกับตัวเลือกนี้ โปรดใช้หน่วยฉุกเฉินในพื้นที่โดยตรง</p>}
              <div className="mt-3 space-y-2">
                {contacts.map((contact) => (
                  <a
                    key={contact.contact_id}
                    href={`tel:${contact.phone}`}
                    className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
                  >
                    <span>
                      <span className="block text-sm font-black text-[#173c29]">{contact.name}</span>
                      <span className="block text-xs text-gray-500">ยืนยันโดย {contact.verified_source_label}</span>
                    </span>
                    <span className="rounded-full bg-[#b42318] px-4 py-2 text-lg font-black text-white">โทร {contact.phone}</span>
                  </a>
                ))}
              </div>

              {callScript && (
                <div className="mt-3 rounded-xl bg-white p-3">
                  <p className="text-xs font-bold text-gray-500">ข้อความช่วยบอกเจ้าหน้าที่</p>
                  <p className="mt-1 text-sm leading-6">{callScript}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">4. ถนนบริเวณนี้</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([["unknown", "ไม่ทราบ"], ["passable", "ผ่านได้"], ["difficult", "ผ่านยาก"], ["closed", "ผ่านไม่ได้"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRoadImpact(key)}
                className={`rounded-xl border p-3 text-sm font-bold ${roadImpact === key ? "border-amber-500 bg-amber-50" : "border-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">5. รายละเอียดเพิ่มเติม</h2>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="เช่น น้ำสูงประมาณเข่า มีผู้สูงอายุ 2 คน รถเล็กผ่านไม่ได้"
            className="mt-3 w-full rounded-2xl border p-3 text-sm"
          />

          <label className="mt-3 block cursor-pointer overflow-hidden rounded-2xl border border-dashed p-3 text-center text-sm text-gray-600">
            {photoPreviewUrl ? (
              <>
                <img src={photoPreviewUrl} alt="ตัวอย่างรูปเหตุการณ์ที่เลือก" className="mx-auto max-h-72 w-full rounded-xl object-cover" />
                <span className="mt-2 block font-semibold">📷 {photo?.name}</span>
                <span className="mt-1 block text-xs text-gray-500">แตะเพื่อถ่ายใหม่ / เลือกรูปใหม่</span>
              </>
            ) : (
              <>📷 ถ่ายรูป / เลือกรูปเหตุการณ์</>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          </label>
          <p className="mt-2 text-xs text-gray-500">รูปเหตุการณ์เก็บในพื้นที่ส่วนตัวและไม่เปิดเป็น public URL โดยอัตโนมัติ</p>
        </section>

        {reportingAccess && !reportingAccess.allowed && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
            บัญชีนี้ถูกจำกัดสิทธิ์การแจ้งเหตุฉุกเฉิน{reportingAccess.ends_at ? ` ถึง ${new Date(reportingAccess.ends_at).toLocaleString("th-TH")}` : ""}
          </div>
        )}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          การแจ้งเหตุเท็จ การส่งเล่น หรือการสแปมจะถูกบันทึกตรวจสอบ และอาจถูกเตือน จำกัดสิทธิ์ หรือแบนการใช้งาน MyTree Emergency ตามประวัติและหลักฐาน
        </div>

        {error && <div role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <button
          type="button"
          disabled={submitting || !category || !point || reportingAccess?.allowed === false}
          onClick={() => void submit()}
          className="w-full rounded-2xl bg-[#b42318] px-5 py-4 text-lg font-black text-white disabled:opacity-40"
        >
          {submitting ? "กำลังส่ง…" : "ส่งแจ้งเหตุ"}
        </button>
      </div>
    </main>
  );
}
