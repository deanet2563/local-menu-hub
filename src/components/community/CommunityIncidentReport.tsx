import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCommunityIncident,
  createIncidentShare,
  getEmergencyReportingAccess,
  getMyEmergencyProfile,
  recommendEmergencyContacts,
  resolveEmergencyArea,
  resolveEmergencyGoogleMapLink,
  uploadIncidentEvidence,
  type EmergencyAreaResolution,
  type EmergencyContact,
  type EmergencyReportingAccess,
  type IncidentCategory,
  type RoadImpact,
} from "@/lib/communityEmergency";
import { EmergencyLocationMap } from "@/components/community/EmergencyLocationMap";
import { IncidentConversationPanel } from "@/components/community/IncidentConversationPanel";
import { LIFF_ID } from "@/lib/supabase";
import { Link } from "@tanstack/react-router";

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
  if (message.includes("google_maps")) return "ไม่สามารถอ่าน Google Maps link นี้ได้ กรุณาตรวจลิงก์แล้วลองอีกครั้ง";
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
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [mapLink, setMapLink] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [incidentAddress, setIncidentAddress] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [reportingAccess, setReportingAccess] = useState<EmergencyReportingAccess | null>(null);
  const [locating, setLocating] = useState(false);
  const [resolvingLink, setResolvingLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
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
    void Promise.all([
      getEmergencyReportingAccess().then(setReportingAccess).catch(() => setReportingAccess({ allowed: true })),
      getMyEmergencyProfile()
        .then((profile) => {
          setReporterName(profile.name ?? "");
          setReporterPhone(profile.phone ?? "");
          setIncidentAddress(profile.default_address ?? "");
        })
        .catch(() => undefined)
        .finally(() => setProfileLoaded(true)),
    ]);
  }, []);

  useEffect(() => {
    if (autoLocateStarted.current) return;
    autoLocateStarted.current = true;
    locate();
  }, []);

  async function loadEmergencyContacts() {
    if (!category || needs.length === 0) {
      setContacts([]);
      setContactsError(null);
      return;
    }
    setContactsLoading(true);
    setContactsError(null);
    try {
      setContacts(await recommendEmergencyContacts(category, needs, area));
    } catch (contactError) {
      setContacts([]);
      setContactsError(contactError instanceof Error ? contactError.message : "โหลดเบอร์ติดต่อไม่สำเร็จ");
    } finally {
      setContactsLoading(false);
    }
  }

  useEffect(() => {
    void loadEmergencyContacts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, needs, area]);

  const callScript = useMemo(() => {
    if (!category || needs.length === 0) return "";
    const categoryLabel = CATEGORIES.find((item) => item.key === category)?.label ?? "เหตุฉุกเฉิน";
    const selectedNeeds = NEEDS.filter(([key]) => needs.includes(key)).map(([, label]) => label);
    const areaLabel = incidentAddress.trim() || area?.area_label || "ตำแหน่งที่ยืนยันไว้";
    const contact = reporterPhone.trim() ? ` เบอร์ติดต่อผู้แจ้ง ${reporterPhone.trim()}` : "";
    return `แจ้งเหตุ ${categoryLabel} ที่ ${areaLabel} ต้องการ ${selectedNeeds.join(" / ")}.${contact}`;
  }, [category, needs, area, incidentAddress, reporterPhone]);

  async function resolveArea(nextPoint: { lat: number; lng: number }) {
    try {
      setArea(await resolveEmergencyArea(nextPoint.lat, nextPoint.lng));
    } catch {
      setArea({
        community_id: null,
        community_name: null,
        area_label: "นอกพื้นที่ชุมชน MyTree",
        province: null,
        district: null,
        distance_m: null,
        resolution_method: "outside-coverage",
        inside_coverage: false,
      });
    }
  }

  function updatePoint(nextPoint: { lat: number; lng: number }) {
    setPoint(nextPoint);
    setLocationConfirmed(false);
    void resolveArea(nextPoint);
  }

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
        setLocationConfirmed(false);
        void resolveArea(nextPoint).finally(() => setLocating(false));
      },
      () => {
        setError("อ่านตำแหน่งไม่สำเร็จ กรุณาอนุญาตตำแหน่ง หรือใช้ Google Maps link แทน");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  async function useGoogleMapLink() {
    if (!mapLink.trim()) return;
    setResolvingLink(true);
    setError(null);
    try {
      const resolved = await resolveEmergencyGoogleMapLink(mapLink.trim());
      const nextPoint = { lat: resolved.lat, lng: resolved.lng };
      setPoint(nextPoint);
      setLocationConfirmed(false);
      if (resolved.formattedAddress && !incidentAddress.trim()) setIncidentAddress(resolved.formattedAddress);
      await resolveArea(nextPoint);
    } catch (linkError) {
      setError(friendlyError(linkError));
    } finally {
      setResolvingLink(false);
    }
  }

  function toggleNeed(key: string) {
    setNeeds((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  async function submit() {
    if (!category || !point || !locationConfirmed) {
      setError("กรุณาระบุประเภทเหตุและกดยืนยันตำแหน่ง");
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
        reporterName,
        reporterPhone,
        incidentAddress,
        submittedMapUrl: mapLink,
      });
      if (photo) await uploadIncidentEvidence(id, photo);
      setResult(id);
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function shareIncident() {
    if (!result) return;
    setSharing(true);
    setError(null);
    try {
      const token = await createIncidentShare(result, 168);
      const url = `https://liff.line.me/${LIFF_ID}/community/help/${token}`;
      setShareUrl(url);
      if (navigator.share) {
        await navigator.share({
          title: "MyTree Emergency — ข้อมูลแจ้งเหตุ",
          text: "เปิดข้อมูลเหตุและข้อมูลติดต่อผู้แจ้งผ่าน MyTree LINE",
          url,
        });
      } else {
        await navigator.clipboard?.writeText(url);
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError(friendlyError(shareError));
    } finally {
      setSharing(false);
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
          <button
            type="button"
            onClick={() => void shareIncident()}
            disabled={sharing}
            className="mt-4 w-full rounded-2xl bg-[#1f6a45] px-4 py-4 font-black text-white disabled:opacity-50"
          >
            {sharing ? "กำลังสร้างลิงก์…" : "↗ แชร์ข้อมูลให้ผู้ช่วยเหลือ"}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            ผู้รับต้องเข้าสู่ MyTree ผ่าน LINE ก่อนจึงจะเห็นชื่อ เบอร์โทร ที่อยู่ พิกัดละเอียด และหลักฐานที่คุณแชร์
          </p>
          {shareUrl && (
            <button type="button" onClick={() => void navigator.clipboard?.writeText(shareUrl)} className="mt-3 w-full rounded-xl border px-3 py-2 text-sm font-semibold">
              คัดลอกลิงก์แชร์
            </button>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              to="/community/my-incidents/$incidentId"
              params={{ incidentId: result }}
              className="rounded-xl border px-3 py-3 text-center text-sm font-black"
            >
              เปิดรายละเอียดเหตุของฉัน
            </Link>
            <Link
              to="/community/incidents"
              className="rounded-xl border px-3 py-3 text-center text-sm font-black"
            >
              ดูเหตุการณ์ทั้งหมด
            </Link>
          </div>
          {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="mx-auto mt-4 max-w-lg">
          <IncidentConversationPanel mode={{ kind: "reporter", incidentId: result }} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f8fbf5] pb-28 text-[#173c29]">
      <header className="bg-[#b42318] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-sm font-bold">MyTree Community</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="mt-1 text-2xl font-black">แจ้งเหตุ / ขอความช่วยเหลือ</h1>
              <p className="mt-2 text-sm text-white/90">ระบุตำแหน่ง ผู้ติดต่อ และสิ่งที่ต้องการ เพื่อส่งต่อให้ผู้ช่วยเหลือได้รวดเร็ว</p>
            </div>
            <Link to="/community/incidents" className="shrink-0 rounded-full bg-white/15 px-3 py-2 text-xs font-black text-white">
              เหตุการณ์ทั้งหมด
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <aside className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-black text-red-800">อันตรายต่อชีวิตหรือเหตุฉุกเฉินทันที?</p>
          <p className="mt-1 text-sm text-red-700">เลือกประเภทเหตุและสิ่งที่ต้องการ ระบบจะแสดงเบอร์ฉุกเฉินที่ผ่านการตรวจสอบให้โทรได้ทันที</p>
        </aside>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">1. จุดเกิดเหตุ & ข้อมูลผู้แจ้ง</h2>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={reporterName} onChange={(event) => setReporterName(event.target.value)} placeholder={profileLoaded ? "ชื่อผู้แจ้ง" : "กำลังโหลดชื่อ…"} className="rounded-xl border p-3 text-sm" />
            <input value={reporterPhone} onChange={(event) => setReporterPhone(event.target.value)} inputMode="tel" placeholder={profileLoaded ? "เบอร์โทรติดต่อ" : "กำลังโหลดเบอร์โทร…"} className="rounded-xl border p-3 text-sm" />
          </div>
          <textarea value={incidentAddress} onChange={(event) => setIncidentAddress(event.target.value)} rows={2} placeholder="ที่อยู่ / บ้านเลขที่ / จุดสังเกตของสถานที่เกิดเหตุ" className="mt-2 w-full rounded-xl border p-3 text-sm" />

          <button type="button" onClick={locate} disabled={locating} className="mt-3 w-full rounded-2xl bg-[#1f6a45] px-4 py-4 font-bold text-white disabled:opacity-70">
            {locating ? "กำลังตรวจตำแหน่ง…" : point ? "📍 ใช้ GPS ปัจจุบันอีกครั้ง" : "📍 ใช้ตำแหน่งปัจจุบัน"}
          </button>

          <div className="mt-3 rounded-2xl border p-3">
            <p className="text-sm font-bold">หรือวาง Google Maps link</p>
            <div className="mt-2 flex gap-2">
              <input value={mapLink} onChange={(event) => setMapLink(event.target.value)} placeholder="https://maps.app.goo.gl/..." className="min-w-0 flex-1 rounded-xl border p-3 text-sm" />
              <button type="button" onClick={() => void useGoogleMapLink()} disabled={resolvingLink || !mapLink.trim()} className="rounded-xl bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-40">
                {resolvingLink ? "กำลังอ่าน…" : "ใช้ลิงก์"}
              </button>
            </div>
          </div>

          <div className="mt-3">
            <EmergencyLocationMap point={point} onPointChange={updatePoint} />
          </div>

          {point && (
            <div className="mt-3 rounded-2xl bg-[#eef7e9] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#1f6a45]">Auto-detected area</p>
              <p className="mt-1 font-black">{area?.area_label ?? "กำลังตรวจพื้นที่…"}</p>
              <p className="mt-1 text-xs text-gray-600">
                {area?.inside_coverage ? "เหตุจะผูกกับพื้นที่นี้อัตโนมัติ ไม่ต้องเป็นสมาชิกชุมชน" : "อยู่นอกพื้นที่ชุมชน MyTree ก็ยังแจ้งเหตุได้"}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setLocationConfirmed(true)}
            disabled={!point}
            className={`mt-3 w-full rounded-2xl px-4 py-4 font-black text-white disabled:opacity-40 ${locationConfirmed ? "bg-[#1f6a45]" : "bg-[#b42318]"}`}
          >
            {locationConfirmed ? "✓ ยืนยันตำแหน่งแล้ว" : "ยืนยันตำแหน่งเกิดเหตุ"}
          </button>
          <p className="mt-2 text-xs text-gray-500">พิกัดละเอียด ชื่อ เบอร์โทร และที่อยู่เป็นข้อมูลจำกัดสิทธิ์ ไม่แสดงบน Public Map</p>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">2. เกิดเหตุอะไร?</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {CATEGORIES.map((item) => (
              <button key={item.key} type="button" onClick={() => setCategory(item.key)} className={`min-h-20 rounded-2xl border p-3 text-left text-sm font-bold ${category === item.key ? "border-[#b42318] bg-red-50" : "border-gray-200"}`}>
                <span className="mr-2 text-xl">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">3. ต้องการอะไร?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEEDS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => toggleNeed(key)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${needs.includes(key) ? "border-[#1f6a45] bg-[#eef7e9] text-[#1f6a45]" : "border-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>

          {category && needs.length > 0 && (
            <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-3">
              <p className="font-black text-red-800">☎️ ติดต่อฉุกเฉินทันที</p>
              <p className="mt-1 text-xs text-red-700">แสดงเฉพาะเบอร์ในทะเบียนที่ตรวจสอบแล้วตามเหตุและพื้นที่</p>
              {contactsLoading && <p className="mt-3 text-sm text-gray-600">กำลังเตรียมเบอร์ติดต่อ…</p>}
              {!contactsLoading && contactsError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-white p-3">
                  <p className="text-sm font-semibold text-red-700">โหลดเบอร์ติดต่อไม่สำเร็จ</p>
                  <button type="button" onClick={() => void loadEmergencyContacts()} className="mt-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-800">ลองใหม่</button>
                </div>
              )}
              {!contactsLoading && !contactsError && contacts.length === 0 && (
                <p className="mt-3 text-sm text-gray-600">ยังไม่พบเบอร์ที่ตรงกับเหตุและความต้องการนี้</p>
              )}
              <div className="mt-3 space-y-2">
                {contacts.map((contact) => (
                  <a key={contact.contact_id} href={`tel:${contact.phone}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <span>
                      <span className="block text-sm font-black text-[#173c29]">{contact.name}</span>
                      <span className="block text-xs text-gray-500">ยืนยันโดย {contact.verified_source_label}</span>
                    </span>
                    <span className="rounded-full bg-[#b42318] px-4 py-2 text-lg font-black text-white">โทร {contact.phone}</span>
                  </a>
                ))}
              </div>
              {callScript && <div className="mt-3 rounded-xl bg-white p-3"><p className="text-xs font-bold text-gray-500">ข้อความช่วยบอกเจ้าหน้าที่</p><p className="mt-1 text-sm leading-6">{callScript}</p></div>}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">4. ถนนบริเวณนี้</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([["unknown", "ไม่ทราบ"], ["passable", "ผ่านได้"], ["difficult", "ผ่านยาก"], ["closed", "ผ่านไม่ได้"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setRoadImpact(key)} className={`rounded-xl border p-3 text-sm font-bold ${roadImpact === key ? "border-amber-500 bg-amber-50" : "border-gray-200"}`}>{label}</button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">5. รายละเอียดเพิ่มเติม</h2>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="เช่น น้ำสูงประมาณเข่า มีผู้สูงอายุ 2 คน รถเล็กผ่านไม่ได้" className="mt-3 w-full rounded-2xl border p-3 text-sm" />
          <label className="mt-3 block cursor-pointer overflow-hidden rounded-2xl border border-dashed p-3 text-center text-sm text-gray-600">
            {photoPreviewUrl ? (
              <>
                <img src={photoPreviewUrl} alt="ตัวอย่างรูปเหตุการณ์ที่เลือก" className="mx-auto max-h-72 w-full rounded-xl object-cover" />
                <span className="mt-2 block font-semibold">📷 {photo?.name}</span>
                <span className="mt-1 block text-xs text-gray-500">แตะเพื่อถ่ายใหม่ / เลือกรูปใหม่</span>
              </>
            ) : <>📷 ถ่ายรูป / เลือกรูปเหตุการณ์</>}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          </label>
        </section>

        {reportingAccess && !reportingAccess.allowed && <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">บัญชีนี้ถูกจำกัดสิทธิ์การแจ้งเหตุฉุกเฉิน</div>}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          การแจ้งเหตุเท็จ การส่งเล่น หรือการสแปมจะถูกบันทึกตรวจสอบ และอาจถูกเตือน จำกัดสิทธิ์ หรือแบนการใช้งาน MyTree Emergency
        </div>

        {error && <div role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <button type="button" disabled={submitting || !category || !point || !locationConfirmed || reportingAccess?.allowed === false} onClick={() => void submit()} className="w-full rounded-2xl bg-[#b42318] px-5 py-4 text-lg font-black text-white disabled:opacity-40">
          {submitting ? "กำลังส่ง…" : "ส่งแจ้งเหตุ"}
        </button>
      </div>
    </main>
  );
}
