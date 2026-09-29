import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  confirmCommunityIncident,
  getPublicIncidentDetail,
  type PublicIncidentDetail,
} from "@/lib/communityEmergency";
import { IncidentGoogleMap } from "@/components/community/IncidentGoogleMap";
import { PublicIncidentHelpPanel } from "@/components/community/PublicIncidentHelpPanel";

const STATUS_LABEL: Record<string,string>={
  reported:"รอรับเรื่อง",verifying:"กำลังตรวจสอบ",coordinating:"กำลังประสานงาน",
  "help-en-route":"ผู้ช่วยกำลังเดินทาง",assisted:"ได้รับการช่วยเหลือแล้ว",
  resolved:"จบเหตุแล้ว",closed:"ปิดเหตุ",duplicate:"เหตุซ้ำ",invalid:"ข้อมูลไม่ถูกต้อง"
};
const VERIFY_LABEL: Record<string,string>={unverified:"ยังไม่ยืนยัน","community-confirmed":"ชุมชนยืนยัน","moderator-verified":"ผู้ดูแลยืนยัน","official-confirmed":"ทางการยืนยัน",disputed:"มีข้อโต้แย้ง"};
const CATEGORY_LABEL: Record<string,string> = {
  medical:"ผู้ป่วย / บาดเจ็บ", flood:"น้ำท่วม", fire:"ไฟไหม้", accident:"อุบัติเหตุ",
  "road-obstruction":"ถนน / ทางผ่านไม่ได้","utility-infrastructure":"สาธารณูปโภค / สิ่งกีดขวาง",
  "missing-person":"บุคคลสูญหาย","evacuation-rescue":"อพยพ / กู้ภัย",supplies:"สิ่งของจำเป็น",other:"เหตุอื่น",
};

export function PublicIncidentDetailView({ incidentId }: { incidentId: string }) {
  const [data,setData]=useState<PublicIncidentDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [confirming,setConfirming]=useState(false);

  async function load(){
    setLoading(true);
    setError(null);
    try{ setData(await getPublicIncidentDetail(incidentId)); }
    catch(e){ setError(e instanceof Error?e.message:"เปิดรายละเอียดเหตุไม่สำเร็จ"); }
    finally{ setLoading(false); }
  }

  useEffect(()=>{ void load(); },[incidentId]);

  if(loading){
    return <main className="min-h-dvh bg-[#f8fbf5] p-5"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 text-center shadow">กำลังโหลดรายละเอียดเหตุ…</div></main>;
  }
  if(error||!data){
    return <main className="min-h-dvh bg-[#f8fbf5] p-5"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow"><h1 className="text-xl font-black text-red-800">เปิดรายละเอียดเหตุไม่ได้</h1><p className="mt-2 text-sm text-gray-600">{error||"ไม่พบเหตุ"}</p><button type="button" onClick={()=>void load()} className="mt-4 rounded-xl bg-[#1f6a45] px-4 py-3 font-black text-white">ลองใหม่</button></div></main>;
  }

  const incident=data.incident;
  return (
    <main className="min-h-dvh bg-[#f8fbf5] pb-24 text-[#173c29]">
      <header className="bg-[#b42318] px-5 py-5 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-black uppercase tracking-wide">Public-safe incident detail</p>
          <h1 className="mt-1 text-2xl font-black">{CATEGORY_LABEL[incident.category]||incident.category}</h1>
          <p className="mt-2 text-sm text-white/90">{incident.community_name}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black">{STATUS_LABEL[incident.status]||incident.status}</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{VERIFY_LABEL[incident.verification_state||"unverified"]||incident.verification_state}</span>
            {incident.road_impact!=="unknown"&&<span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">ถนน: {incident.road_impact}</span>}
          </div>
          {incident.description&&<p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{incident.description}</p>}
          {incident.need_tags.length>0&&<div className="mt-4 flex flex-wrap gap-2">{incident.need_tags.map((tag)=><span key={tag} className="rounded-full bg-[#eef7e9] px-3 py-1 text-xs font-bold text-[#1f6a45]">{tag}</span>)}</div>}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div className="rounded-xl bg-gray-50 p-3"><p className="font-bold">ผู้ช่วย</p><p className="mt-1 text-lg font-black text-[#173c29]">{data.summary.responder_count}</p></div>
            <div className="rounded-xl bg-gray-50 p-3"><p className="font-bold">ข้อความประสานงาน</p><p className="mt-1 text-lg font-black text-[#173c29]">{data.summary.message_count}</p></div>
          </div>
          <p className="mt-4 text-xs text-gray-500">อัปเดตล่าสุด {new Date(incident.updated_at).toLocaleString("th-TH")}</p>
        </section>

        {incident.public_lat!==null&&incident.public_lng!==null&&(
          <section className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="font-black">ตำแหน่งโดยประมาณ</h2>
            <p className="mt-1 text-xs text-gray-500">ตำแหน่งระดับ {incident.public_location_precision} ไม่ใช่พิกัดละเอียดของบ้านหรือผู้ประสบเหตุ</p>
            <div className="mt-3 overflow-hidden rounded-2xl">
              <IncidentGoogleMap incidents={[incident]} risks={[]} onSelectIncident={()=>undefined} />
            </div>
          </section>
        )}

        <PublicIncidentHelpPanel detail={data} />

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-black">ช่วยยืนยันข้อมูลจากชุมชน</h2>
          <p className="mt-1 text-xs text-gray-500">การยืนยันอาจต้องเป็นสมาชิก/ผู้ดูแลชุมชนนั้นตาม privacy policy</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={confirming} onClick={()=>{setConfirming(true);void confirmCommunityIncident(incident.incident_id,"confirm").then(load).catch((e)=>setError(e instanceof Error?e.message:"ยืนยันเหตุไม่สำเร็จ")).finally(()=>setConfirming(false));}} className="rounded-xl bg-[#1f6a45] px-3 py-3 text-sm font-black text-white disabled:opacity-50">✓ ยืนยันว่าเห็นเหตุ</button>
            <button type="button" disabled={confirming} onClick={()=>{setConfirming(true);void confirmCommunityIncident(incident.incident_id,"dispute").then(load).catch((e)=>setError(e instanceof Error?e.message:"ส่งข้อโต้แย้งไม่สำเร็จ")).finally(()=>setConfirming(false));}} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm font-black text-amber-900 disabled:opacity-50">ข้อมูลไม่ตรง</button>
          </div>
          {error&&<p className="mt-3 text-xs text-red-700">{error}</p>}
        </section>

        <Link to="/community/incidents" className="block rounded-2xl border bg-white px-4 py-3 text-center text-sm font-black shadow-sm">
          ← กลับไปเหตุการณ์ทั้งหมด
        </Link>
      </div>
    </main>
  );
}
