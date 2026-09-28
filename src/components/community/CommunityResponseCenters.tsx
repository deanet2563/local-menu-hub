import type { CommunityResponsePoint } from "@/lib/communityEmergency";

const TYPE_LABEL: Record<string,string> = {
 "official-emergency":"หน่วยฉุกเฉินทางการ",medical:"การแพทย์",community:"ศูนย์ชุมชน",
 volunteer:"อาสาสมัคร",shelter:"ศูนย์พักพิง",other:"จุดช่วยเหลือ",
};
export function CommunityResponseCenters({points}:{points:CommunityResponsePoint[]}) {
 if(points.length===0)return <section className="rounded-2xl border bg-white p-4"><h2 className="font-black">จุดรับแจ้งเหตุ / จุดช่วยเหลือ</h2><p className="mt-2 text-sm text-gray-600">ยังไม่มีจุดช่วยเหลือที่เปิดใช้งานในระบบสำหรับชุมชนนี้</p></section>;
 return <section><div className="mb-2"><h2 className="font-black">จุดรับแจ้งเหตุ / จุดช่วยเหลือ</h2><p className="text-xs text-gray-500">หน่วยทางการและจุดชุมชนแสดงแยกประเภทอย่างชัดเจน</p></div><div className="grid gap-3 md:grid-cols-2">{points.map((point)=><article key={point.response_point_id} className={`rounded-2xl border bg-white p-4 shadow-sm ${point.contact_type==="official-emergency"?"border-red-200":"border-gray-200"}`}><div className="flex items-start justify-between gap-3"><div><p className={`text-xs font-black ${point.contact_type==="official-emergency"?"text-red-700":"text-[#1f6a45]"}`}>{TYPE_LABEL[point.contact_type]||point.contact_type}{point.is_nearby?" · ชุมชนใกล้เคียง":""}</p><h3 className="mt-1 font-black">{point.name}</h3></div>{point.phone&&<a href={`tel:${point.phone}`} className="shrink-0 rounded-xl bg-[#b42318] px-4 py-3 text-sm font-black text-white">☎ โทร</a>}</div>{point.location_precision!=="hidden"&&point.lat!==null&&point.lng!==null&&<a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${point.lat},${point.lng}`)}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-[#1f6a45] underline">เปิดนำทาง</a>}</article>)}</div></section>;
}
