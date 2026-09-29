import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  confirmCommunityIncident,
  listBrowseCommunityIncidents,
  listCommunityResponsePoints,
  listCommunityRisks,
  listEmergencyCommunities,
  listNearbyPublicIncidents,
  resolveEmergencyArea,
  type CommunityResponsePoint,
  type CommunityRisk,
  type EmergencyAreaResolution,
  type EmergencyCommunityOption,
  type NearbyPublicIncident,
  type PublicIncident,
} from "@/lib/communityEmergency";
import { CommunityResponseCenters } from "@/components/community/CommunityResponseCenters";
import { IncidentGoogleMap } from "@/components/community/IncidentGoogleMap";

const INCIDENT_LABEL: Record<string,string> = {
  medical:"ผู้ป่วย / บาดเจ็บ", flood:"น้ำท่วม", fire:"ไฟไหม้", accident:"อุบัติเหตุ",
  "road-obstruction":"ถนน / ทางผ่านไม่ได้","utility-infrastructure":"สาธารณูปโภค / สิ่งกีดขวาง",
  "missing-person":"บุคคลสูญหาย","evacuation-rescue":"อพยพ / กู้ภัย",supplies:"สิ่งของจำเป็น",other:"เหตุอื่น",
};
const RISK_LABEL = { advisory:"เฝ้าระวัง", watch:"จับตา", warning:"เตือน", emergency:"ฉุกเฉิน" } as const;
const VERIFY_LABEL: Record<string,string>={unverified:"ยังไม่ยืนยัน","community-confirmed":"ชุมชนยืนยัน","moderator-verified":"ผู้ดูแลยืนยัน","official-confirmed":"ทางการยืนยัน",disputed:"มีข้อโต้แย้ง"};
const STATUS_LABEL: Record<string,string>={
  reported:"รอรับเรื่อง",verifying:"กำลังตรวจสอบ",coordinating:"กำลังประสานงาน",
  "help-en-route":"ผู้ช่วยกำลังเดินทาง",assisted:"ได้รับการช่วยเหลือแล้ว",
  resolved:"จบเหตุแล้ว",closed:"ปิดเหตุ",duplicate:"เหตุซ้ำ",invalid:"ข้อมูลไม่ถูกต้อง"
};

function ageLabel(value:string) {
  const minutes=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/60000));
  if(minutes<1)return "เมื่อสักครู่";
  if(minutes<60)return `${minutes} นาทีที่แล้ว`;
  const hours=Math.round(minutes/60);
  return hours<24?`${hours} ชม.ที่แล้ว`:`${Math.round(hours/24)} วันที่แล้ว`;
}

function distanceMeters(a:{lat:number;lng:number},b:{lat:number;lng:number}) {
  const toRad=(value:number)=>value*Math.PI/180;
  const earth=6371000;
  const dLat=toRad(b.lat-a.lat);
  const dLng=toRad(b.lng-a.lng);
  const lat1=toRad(a.lat);
  const lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return Math.round(2*earth*Math.asin(Math.min(1,Math.sqrt(h))));
}

function distanceLabel(value?: number) {
  if (typeof value !== "number") return null;
  if (value < 1000) return `${value} ม.`;
  return `${(value/1000).toFixed(value < 10000 ? 1 : 0)} กม.`;
}

function RiskCard({risk}:{risk:CommunityRisk}) {
  return <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-amber-800">{risk.provenance==="official"?"ประกาศจากแหล่งทางการ":"MyTree Forecast"}</p>
        <h3 className="mt-1 font-black">{risk.hazard}</h3>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800">{RISK_LABEL[risk.level]}</span>
    </div>
    <p className="mt-2 text-xs text-gray-600">อัปเดต {ageLabel(risk.updated_at)} · ใช้ถึง {new Date(risk.expires_at).toLocaleString("th-TH")}</p>
    {risk.provenance==="forecast"&&<p className="mt-2 text-xs font-semibold text-amber-900">เป็นการคาดการณ์ ไม่ใช่การยืนยันว่าจะเกิดเหตุ</p>}
  </article>;
}

function IncidentCard({incident}:{incident:PublicIncident & Partial<NearbyPublicIncident>}) {
  const distance=distanceLabel(incident.distance_m);
  const communityName="community_name" in incident ? incident.community_name : null;
  return (
    <Link
      to="/community/incidents/$incidentId"
      params={{ incidentId: incident.incident_id }}
      className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#b42318]">รายงานจากชุมชน</p>
          <h3 className="mt-1 font-black">{INCIDENT_LABEL[incident.category]||incident.category}</h3>
          {communityName&&<p className="mt-1 text-xs text-gray-500">{communityName}</p>}
        </div>
        <div className="text-right">
          <span className="block text-xs text-gray-500">{ageLabel(incident.updated_at)}</span>
          {distance&&<span className="mt-1 block text-xs font-black text-[#1f6a45]">{distance}</span>}
        </div>
      </div>
      {incident.description&&<p className="mt-2 line-clamp-3 text-sm text-gray-700">{incident.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs">{STATUS_LABEL[incident.status]||incident.status}</span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{VERIFY_LABEL[incident.verification_state||"unverified"]||incident.verification_state}</span>
        {incident.road_impact!=="unknown"&&<span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">ถนน: {incident.road_impact}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500">ตำแหน่ง public-safe ระดับ {incident.public_location_precision}</p>
        <span className="shrink-0 text-xs font-black text-[#1f6a45]">ดูรายละเอียด ›</span>
      </div>
    </Link>
  );
}

export function CommunityIncidentMap() {
  const [scope,setScope]=useState<"nearby"|"community">("nearby");
  const [communities,setCommunities]=useState<EmergencyCommunityOption[]>([]);
  const [communityId,setCommunityId]=useState("");
  const [point,setPoint]=useState<{lat:number;lng:number}|null>(null);
  const [area,setArea]=useState<EmergencyAreaResolution|null>(null);
  const [radiusMeters,setRadiusMeters]=useState(5000);
  const [incidents,setIncidents]=useState<Array<PublicIncident & Partial<NearbyPublicIncident>>>([]);
  const [risks,setRisks]=useState<CommunityRisk[]>([]);
  const [responsePoints,setResponsePoints]=useState<CommunityResponsePoint[]>([]);
  const [loading,setLoading]=useState(true);
  const [locating,setLocating]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [locationError,setLocationError]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("");
  const [roadFilter,setRoadFilter]=useState("");
  const [selectedIncident,setSelectedIncident]=useState<(PublicIncident & Partial<NearbyPublicIncident>)|null>(null);
  const [confirming,setConfirming]=useState(false);

  async function locateNow(){
    if(!navigator.geolocation){
      setLocationError("อุปกรณ์นี้ไม่รองรับ GPS");
      setLocating(false);
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position)=>{
        const next={lat:position.coords.latitude,lng:position.coords.longitude};
        setPoint(next);
        void resolveEmergencyArea(next.lat,next.lng)
          .then((resolved)=>{
            setArea(resolved);
            if(resolved.community_id&&!communityId)setCommunityId(resolved.community_id);
          })
          .catch(()=>setArea(null))
          .finally(()=>setLocating(false));
      },
      ()=>{
        setLocationError("อ่านตำแหน่งปัจจุบันไม่สำเร็จ สามารถเลือกชุมชนแทนได้");
        setLocating(false);
      },
      {enableHighAccuracy:true,timeout:10000,maximumAge:30000},
    );
  }

  useEffect(()=>{
    void listEmergencyCommunities()
      .then((items)=>{
        setCommunities(items);
        if(!communityId&&items[0])setCommunityId(items[0].community_id);
      })
      .catch((e)=>setError(e instanceof Error?e.message:"โหลดรายชื่อชุมชนไม่สำเร็จ"));
    void locateNow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      setLoading(true);
      setError(null);
      try{
        if(scope==="nearby"){
          if(!point){setIncidents([]);setRisks([]);setResponsePoints([]);return;}
          const detectedCommunity=area?.community_id||null;

          const [legacyNearby,communityLists,nextRisks,nextPoints]=await Promise.all([
            listNearbyPublicIncidents(point.lat,point.lng,radiusMeters).catch(()=>[] as NearbyPublicIncident[]),
            Promise.all(
              communities.map((community)=>
                listBrowseCommunityIncidents(community.community_id).catch(()=>[])
              )
            ),
            detectedCommunity
              ? listCommunityRisks(detectedCommunity).catch(()=>[] as CommunityRisk[])
              : Promise.resolve([] as CommunityRisk[]),
            detectedCommunity
              ? listCommunityResponsePoints(detectedCommunity).catch(()=>[] as CommunityResponsePoint[])
              : Promise.resolve([] as CommunityResponsePoint[]),
          ]);

          const byId=new Map<string,PublicIncident & Partial<NearbyPublicIncident>>();
          for(const incident of legacyNearby)byId.set(incident.incident_id,incident);
          for(const list of communityLists){
            for(const incident of list){
              if(incident.public_lat===null||incident.public_lng===null)continue;
              const distance_m=distanceMeters(point,{lat:incident.public_lat,lng:incident.public_lng});
              if(distance_m<=radiusMeters){
                byId.set(incident.incident_id,{...incident,distance_m});
              }
            }
          }
          const nearby=Array.from(byId.values()).sort((a,b)=>
            (a.distance_m??Number.MAX_SAFE_INTEGER)-(b.distance_m??Number.MAX_SAFE_INTEGER)
            || new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()
          );

          if(cancelled)return;
          setIncidents(nearby);
          setRisks(nextRisks);
          setResponsePoints(nextPoints);
        }else{
          if(!communityId){setIncidents([]);setRisks([]);setResponsePoints([]);return;}
          const [browseIncidents,nextRisks,points]=await Promise.all([
            listBrowseCommunityIncidents(communityId),
            listCommunityRisks(communityId).catch(()=>[] as CommunityRisk[]),
            listCommunityResponsePoints(communityId).catch(()=>[] as CommunityResponsePoint[]),
          ]);
          if(cancelled)return;
          setIncidents(browseIncidents);
          setRisks(nextRisks);
          setResponsePoints(points);
        }
      }catch(e){
        if(!cancelled)setError(e instanceof Error?e.message:"โหลดข้อมูลเหตุการณ์ไม่สำเร็จ");
      }finally{
        if(!cancelled)setLoading(false);
      }
    }
    void load();
    return()=>{cancelled=true;};
  },[scope,point,radiusMeters,communityId,area?.community_id,communities]);

  const filteredIncidents=useMemo(()=>incidents.filter((incident)=>{
    const text=search.trim().toLowerCase();
    if(statusFilter&&incident.status!==statusFilter)return false;
    if(categoryFilter&&incident.category!==categoryFilter)return false;
    if(roadFilter&&incident.road_impact!==roadFilter)return false;
    if(!text)return true;
    return [
      incident.description||"",
      INCIDENT_LABEL[incident.category]||incident.category,
      STATUS_LABEL[incident.status]||incident.status,
      incident.road_impact,
      "community_name" in incident ? incident.community_name||"" : "",
      ...(incident.need_tags||[]),
    ].join(" ").toLowerCase().includes(text);
  }),[incidents,search,statusFilter,categoryFilter,roadFilter]);

  const mapped=useMemo(()=>filteredIncidents.filter((i)=>i.public_lat!==null&&i.public_lng!==null),[filteredIncidents]);
  const responseCommunityId=scope==="nearby"?(area?.community_id||""):communityId;

  return (
    <main className="min-h-dvh bg-[#f8fbf5] pb-24 text-[#173c29]">
      <header className="border-b bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#b42318]">Community Safety</p>
              <h1 className="text-2xl font-black">เหตุการณ์ & การแจ้งเตือน</h1>
            </div>
            <Link to="/community/report" className="rounded-full bg-[#b42318] px-4 py-3 text-sm font-black text-white">⚠️ แจ้งเหตุ</Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-1">
            <button type="button" onClick={()=>setScope("nearby")} className={"rounded-xl px-3 py-3 text-sm font-black "+(scope==="nearby"?"bg-[#1f6a45] text-white":"text-gray-600")}>
              📍 ใกล้ฉัน
            </button>
            <button type="button" onClick={()=>setScope("community")} className={"rounded-xl px-3 py-3 text-sm font-black "+(scope==="community"?"bg-[#1f6a45] text-white":"text-gray-600")}>
              🌳 เลือกชุมชน
            </button>
          </div>

          {scope==="nearby"?(
            <div className="mt-3 rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-500">ตำแหน่งปัจจุบัน</p>
                  <p className="font-black">{locating?"กำลังตรวจ GPS…":area?.area_label||"ตำแหน่งของโทรศัพท์"}</p>
                </div>
                <button type="button" onClick={locateNow} disabled={locating} className="rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50">ตรวจ GPS ใหม่</button>
              </div>
              {locationError&&<p className="mt-2 text-xs text-red-700">{locationError}</p>}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">ระยะ</span>
                {[1000,3000,5000,10000].map((radius)=>(
                  <button key={radius} type="button" onClick={()=>setRadiusMeters(radius)} className={"rounded-full border px-3 py-1.5 text-xs font-bold "+(radiusMeters===radius?"border-[#1f6a45] bg-[#eef7e9] text-[#1f6a45]":"border-gray-200")}>
                    {radius/1000} กม.
                  </button>
                ))}
              </div>
            </div>
          ):(
            <select value={communityId} onChange={(e)=>setCommunityId(e.target.value)} className="mt-3 w-full rounded-xl border p-3 text-sm">
              <option value="">เลือกชุมชน</option>
              {communities.map((community)=><option key={community.community_id} value={community.community_id}>{community.name}</option>)}
            </select>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-black">ค้นหา & กรองเหตุการณ์</h2><p className="text-xs text-gray-500">กรองตามสถานะ ประเภทเหตุ และสภาพถนน</p></div>
            <button type="button" onClick={()=>{setSearch("");setStatusFilter("");setCategoryFilter("");setRoadFilter("");}} className="rounded-lg border px-3 py-2 text-xs font-bold">ล้างตัวกรอง</button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ค้นหารายละเอียด / ความต้องการ" className="rounded-xl border p-3 text-sm" />
            <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="rounded-xl border p-3 text-sm">
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)} className="rounded-xl border p-3 text-sm">
              <option value="">ทุกประเภทเหตุ</option>
              {Object.entries(INCIDENT_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
            <select value={roadFilter} onChange={(e)=>setRoadFilter(e.target.value)} className="rounded-xl border p-3 text-sm">
              <option value="">ทุกสภาพถนน</option>
              <option value="unknown">ไม่ทราบ</option><option value="passable">ผ่านได้</option><option value="difficult">ผ่านยาก</option><option value="closed">ผ่านไม่ได้</option>
            </select>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            แสดง <b>{filteredIncidents.length}</b> จาก {incidents.length} เหตุ · {scope==="nearby"?`ใกล้ฉันภายใน ${radiusMeters/1000} กม.`:"ชุมชนที่เลือก"}
          </p>
        </section>

        {risks.length>0&&<section><h2 className="mb-2 font-black">แจ้งเตือนและความเสี่ยง</h2><div className="grid gap-2 md:grid-cols-2">{risks.map((risk)=><RiskCard key={risk.risk_id} risk={risk}/>)}</div></section>}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div><h2 className="font-black">Incident Map</h2><p className="text-xs text-gray-500">แสดงเฉพาะตำแหน่ง public-safe · ไม่แสดงพิกัดละเอียดของผู้ประสบเหตุ</p></div>
            <span className="text-xs font-semibold text-[#b42318]">{mapped.length} เหตุ</span>
          </div>
          <div className="relative">
            <IncidentGoogleMap incidents={filteredIncidents} risks={risks} onSelectIncident={setSelectedIncident} focusPoint={scope==="nearby"?point:null} />
            {selectedIncident&&(
              <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-red-100 bg-white p-4 shadow-2xl">
                <button type="button" onClick={()=>setSelectedIncident(null)} aria-label="ปิดรายละเอียดเหตุ" className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border bg-white text-xl">×</button>
                <div className="pr-10">
                  <p className="text-xs font-black text-[#b42318]">รายงานจากชุมชน · {ageLabel(selectedIncident.updated_at)}</p>
                  <h3 className="mt-1 text-lg font-black">{INCIDENT_LABEL[selectedIncident.category]||selectedIncident.category}</h3>
                  {selectedIncident.description&&<p className="mt-2 text-sm text-gray-700">{selectedIncident.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedIncident.need_tags.map((need)=><span key={need} className="rounded-full bg-[#eef7e9] px-2.5 py-1 text-xs font-semibold text-[#1f6a45]">{need}</span>)}
                    {selectedIncident.road_impact!=="unknown"&&<span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">ถนน: {selectedIncident.road_impact}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{VERIFY_LABEL[selectedIncident.verification_state||"unverified"]||selectedIncident.verification_state}</span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs">{selectedIncident.verification_count||0} คนยืนยัน</span>
                  </div>
                  <Link to="/community/incidents/$incidentId" params={{incidentId:selectedIncident.incident_id}} className="mt-3 block rounded-xl bg-[#1f6a45] px-3 py-2.5 text-center text-sm font-black text-white">ดูรายละเอียดเหตุ</Link>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={confirming} onClick={()=>{setConfirming(true);void confirmCommunityIncident(selectedIncident.incident_id,"confirm").then(()=>setSelectedIncident({...selectedIncident,verification_count:(selectedIncident.verification_count||0)+1})).catch((e)=>setError(e instanceof Error?e.message:"ยืนยันเหตุไม่สำเร็จ")).finally(()=>setConfirming(false));}} className="rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50">✓ ยืนยันว่าเห็นเหตุ</button>
                    <button type="button" disabled={confirming} onClick={()=>{setConfirming(true);void confirmCommunityIncident(selectedIncident.incident_id,"dispute").then(()=>setSelectedIncident({...selectedIncident,verification_state:"disputed"})).catch((e)=>setError(e instanceof Error?e.message:"ส่งข้อโต้แย้งไม่สำเร็จ")).finally(()=>setConfirming(false));}} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900 disabled:opacity-50">ข้อมูลไม่ตรง</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {responseCommunityId&&responsePoints.length>0&&<CommunityResponseCenters points={responsePoints} communityId={responseCommunityId}/>}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-black">{scope==="nearby"?"เหตุใกล้ฉัน":"เหตุล่าสุด"}</h2>
            <span className="text-xs text-gray-500">{filteredIncidents.length} เหตุ</span>
          </div>
          {loading?(
            <div className="rounded-2xl bg-white p-6 text-center text-sm">กำลังโหลด…</div>
          ):error?(
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ):filteredIncidents.length===0?(
            <div className="rounded-2xl bg-white p-6 text-center text-sm shadow-sm">ยังไม่พบเหตุในขอบเขตที่เลือก</div>
          ):(
            <div className="grid gap-3 md:grid-cols-2">{filteredIncidents.map((incident)=><IncidentCard key={incident.incident_id} incident={incident}/>)}</div>
          )}
        </section>
      </div>
    </main>
  );
}
