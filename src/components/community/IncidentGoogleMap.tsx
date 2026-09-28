import { useEffect, useMemo, useRef, useState } from "react";
import { currentMyTreeMaps, loadMyTreeMaps, myTreeMapOptions, type GoogleMapListener, type MyTreeGoogleMap, type MyTreeGoogleMarker } from "@/lib/myTreeGoogleMaps";
import type { CommunityRisk, PublicIncident } from "@/lib/communityEmergency";

function incidentGlyph(category: string) {
  return category==="flood"?"🌊":category==="fire"?"🔥":category==="medical"?"✚":category==="accident"?"!":category==="road-obstruction"?"×":"!";
}
function incidentMarkerIcon(incident: PublicIncident): Record<string,unknown>|undefined {
  const google=currentMyTreeMaps(); if(!google?.maps.Size||!google.maps.Point)return undefined;
  const stroke=incident.road_impact==="closed"||incident.severity==="critical"?"#b42318":"#d97706";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56"><path d="M24 55 16 42h16L24 55Z" fill="${stroke}"/><circle cx="24" cy="22" r="20" fill="#fff" stroke="${stroke}" stroke-width="4"/><text x="24" y="29" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="800">${incidentGlyph(incident.category)}</text></svg>`;
  return {url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,scaledSize:new google.maps.Size(48,56),anchor:new google.maps.Point(24,56)};
}
// Shared loader extracted from the approved Main Map behavior; safety markers remain a separate overlay contract.
export function IncidentGoogleMap({incidents,risks,onSelectIncident}:{incidents:PublicIncident[];risks:CommunityRisk[];onSelectIncident?:(incident:PublicIncident)=>void}) {
 const el=useRef<HTMLDivElement|null>(null); const map=useRef<MyTreeGoogleMap|null>(null);
 const handles=useRef<Array<{marker:MyTreeGoogleMarker;listener:GoogleMapListener}>>([]);
 const [error,setError]=useState(false); const [ready,setReady]=useState(false);
 const visible=useMemo(()=>incidents.filter((i)=>i.public_lat!==null&&i.public_lng!==null&&i.public_location_precision!=="hidden"),[incidents]);
 const riskPoints=useMemo(()=>risks.filter((r)=>r.public_lat!==null&&r.public_lng!==null),[risks]);
 useEffect(()=>{let disposed=false;void loadMyTreeMaps().then((google)=>{if(disposed||!el.current)return;map.current=new google.maps.Map(el.current,myTreeMapOptions({lat:13.777,lng:100.674},14));setReady(true);}).catch(()=>setError(true));return()=>{disposed=true;handles.current.forEach(({marker,listener})=>{listener.remove();marker.setMap(null);});handles.current=[];map.current=null;};},[]);
 useEffect(()=>{const g=currentMyTreeMaps(),m=map.current;if(!ready||!g||!m)return;handles.current.forEach(({marker,listener})=>{listener.remove();marker.setMap(null);});handles.current=[];const bounds=new g.maps.LatLngBounds();
 visible.forEach((incident)=>{const pos={lat:incident.public_lat!,lng:incident.public_lng!};bounds.extend(pos);const marker=new g.maps.Marker({map:m,position:pos,title:incident.title||incident.category,icon:incidentMarkerIcon(incident),zIndex:20000});const listener=marker.addListener("click",()=>onSelectIncident?.(incident));handles.current.push({marker,listener});});
 riskPoints.forEach((risk)=>{const pos={lat:risk.public_lat!,lng:risk.public_lng!};bounds.extend(pos);const marker=new g.maps.Marker({map:m,position:pos,title:`${risk.provenance}: ${risk.hazard}`,label:{text:risk.provenance==="official"?"⚠":"AI",fontWeight:"700"},zIndex:10000});const listener=marker.addListener("click",()=>{});handles.current.push({marker,listener});});
 if(visible.length+riskPoints.length>0)m.fitBounds(bounds,56);
 },[onSelectIncident,ready,riskPoints,visible]);
 return <div className="relative h-[420px] min-h-[360px] overflow-hidden rounded-3xl border bg-[#eef3ec]"><div ref={el} className="h-full w-full"/>{error&&<div className="absolute inset-0 grid place-items-center bg-[#f8fbf5] p-6 text-center text-sm"><div><p className="font-black">เปิดแผนที่ไม่ได้ในขณะนี้</p><p className="mt-1 text-gray-600">รายการเหตุการณ์ด้านล่างยังใช้งานได้</p></div></div>}<div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-xs shadow"><b>{visible.length}</b> เหตุบนแผนที่ · <b>{riskPoints.length}</b> จุดความเสี่ยง</div></div>;
}
