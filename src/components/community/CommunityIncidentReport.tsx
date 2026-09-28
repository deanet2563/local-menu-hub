import { useState } from "react";
import { createCommunityIncident, type IncidentCategory, type RoadImpact } from "@/lib/communityEmergency";

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
  ["medical-help","ความช่วยเหลือทางการแพทย์"],["rescue","กู้ภัย"],["evacuation","อพยพ"],
  ["transport","รถ / การเดินทาง"],["food","อาหาร"],["drinking-water","น้ำดื่ม"],
  ["medicine","ยา"],["power","ไฟฟ้า / ชาร์จแบต"],["shelter","ที่พัก"],["volunteers","อาสาสมัคร"],
] as const;

export function CommunityIncidentReport() {
  const [communityId, setCommunityId] = useState("");
  const [category, setCategory] = useState<IncidentCategory | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [roadImpact, setRoadImpact] = useState<RoadImpact>("unknown");
  const [description, setDescription] = useState("");
  const [point, setPoint] = useState<{lat:number;lng:number}|null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);

  function locate() {
    setLocating(true); setError(null);
    navigator.geolocation?.getCurrentPosition(
      (p) => { setPoint({lat:p.coords.latitude,lng:p.coords.longitude}); setLocating(false); },
      () => { setError("อ่านตำแหน่งไม่สำเร็จ กรุณาอนุญาตตำแหน่งหรือลองอีกครั้ง"); setLocating(false); },
      { enableHighAccuracy:true, timeout:10000, maximumAge:30000 },
    );
  }
  function toggleNeed(key:string) {
    setNeeds((current) => current.includes(key) ? current.filter((v)=>v!==key) : [...current,key]);
  }
  async function submit() {
    if (!communityId || !category || !point) { setError("กรุณาระบุชุมชน ประเภทเหตุ และตำแหน่ง"); return; }
    setSubmitting(true); setError(null);
    try {
      const id = await createCommunityIncident({
        communityId, category, severity:"unknown", description, needTags:needs, roadImpact,
        exactLat:point.lat, exactLng:point.lng,
        // M2 defaults public display to block precision; the server retains exact privately.
        publicLat:Number(point.lat.toFixed(3)), publicLng:Number(point.lng.toFixed(3)),
        publicLocationPrecision:"block",
      });
      setResult(id);
    } catch (e) { setError(e instanceof Error ? e.message : "ส่งรายงานไม่สำเร็จ"); }
    finally { setSubmitting(false); }
  }

  if (result) return <main className="min-h-dvh bg-[#f8fbf5] p-5 text-[#173c29]"><div className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow"><div className="text-5xl">✓</div><h1 className="mt-4 text-2xl font-black">รับแจ้งเหตุแล้ว</h1><p className="mt-2 text-sm text-gray-600">เลขอ้างอิง {result}</p><p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">หากมีอันตรายต่อชีวิต โปรดติดต่อหน่วยฉุกเฉินโดยตรง อย่ารอการตอบกลับจาก MyTree</p></div></main>;

  return <main className="min-h-dvh bg-[#f8fbf5] pb-28 text-[#173c29]">
    <header className="bg-[#b42318] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto max-w-lg"><p className="text-sm font-bold">MyTree Community</p><h1 className="mt-1 text-2xl font-black">แจ้งเหตุ / ขอความช่วยเหลือ</h1><p className="mt-2 text-sm text-white/90">แจ้งตำแหน่งและสิ่งที่ต้องการให้ชุมชนช่วยประสานงาน</p></div>
    </header>
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <aside className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="font-black text-red-800">อันตรายต่อชีวิตหรือเหตุฉุกเฉินทันที?</p><p className="mt-1 text-sm text-red-700">โปรดติดต่อหน่วยฉุกเฉินโดยตรงก่อน MyTree เป็นช่องทางเสริมสำหรับการประสานงานในชุมชน</p></aside>
      <section className="rounded-3xl bg-white p-4 shadow-sm"><h2 className="font-black">1. จุดเกิดเหตุ</h2><button type="button" onClick={locate} className="mt-3 w-full rounded-2xl bg-[#1f6a45] px-4 py-4 font-bold text-white">{locating?"กำลังหาตำแหน่ง…":point?"✓ ได้ตำแหน่งแล้ว":"📍 ใช้ตำแหน่งปัจจุบัน"}</button>{point&&<p className="mt-2 text-xs text-gray-500">ตำแหน่งละเอียดจะเก็บเป็นข้อมูลจำกัดสิทธิ์ แผนที่สาธารณะใช้ตำแหน่งโดยประมาณ</p>}<input value={communityId} onChange={(e)=>setCommunityId(e.target.value)} placeholder="Community ID (ชั่วคราวสำหรับ M2 QA)" className="mt-3 w-full rounded-xl border p-3 text-sm" /></section>
      <section className="rounded-3xl bg-white p-4 shadow-sm"><h2 className="font-black">2. เกิดเหตุอะไร?</h2><div className="mt-3 grid grid-cols-2 gap-2">{CATEGORIES.map((c)=><button key={c.key} type="button" onClick={()=>setCategory(c.key)} className={`min-h-20 rounded-2xl border p-3 text-left text-sm font-bold ${category===c.key?"border-[#b42318] bg-red-50":"border-gray-200"}`}><span className="mr-2 text-xl">{c.icon}</span>{c.label}</button>)}</div></section>
      <section className="rounded-3xl bg-white p-4 shadow-sm"><h2 className="font-black">3. ต้องการอะไร?</h2><div className="mt-3 flex flex-wrap gap-2">{NEEDS.map(([key,label])=><button key={key} type="button" onClick={()=>toggleNeed(key)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${needs.includes(key)?"border-[#1f6a45] bg-[#eef7e9] text-[#1f6a45]":"border-gray-200"}`}>{label}</button>)}</div></section>
      <section className="rounded-3xl bg-white p-4 shadow-sm"><h2 className="font-black">4. ถนนบริเวณนี้</h2><div className="mt-3 grid grid-cols-2 gap-2">{([["unknown","ไม่ทราบ"],["passable","ผ่านได้"],["difficult","ผ่านยาก"],["closed","ผ่านไม่ได้"]] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setRoadImpact(key)} className={`rounded-xl border p-3 text-sm font-bold ${roadImpact===key?"border-amber-500 bg-amber-50":"border-gray-200"}`}>{label}</button>)}</div></section>
      <section className="rounded-3xl bg-white p-4 shadow-sm"><h2 className="font-black">5. รายละเอียดเพิ่มเติม</h2><textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={4} placeholder="เช่น น้ำสูงประมาณเข่า มีผู้สูงอายุ 2 คน รถเล็กผ่านไม่ได้" className="mt-3 w-full rounded-2xl border p-3 text-sm" /><div className="mt-3 rounded-2xl border border-dashed p-4 text-center text-sm text-gray-500">📷 รูปภาพ — จะเชื่อม Storage ใน M2.1 หลัง policy upload ผ่าน security review</div></section>
      {error&&<div role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button type="button" disabled={submitting||!category||!point||!communityId} onClick={()=>void submit()} className="w-full rounded-2xl bg-[#b42318] px-5 py-4 text-lg font-black text-white disabled:opacity-40">{submitting?"กำลังส่ง…":"ส่งแจ้งเหตุ"}</button>
    </div>
  </main>;
}
