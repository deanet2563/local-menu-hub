import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { shopStorageFolder, safeImageExtension } from "@/lib/storageKey";

type Hours = Record<string, { open?: string; close?: string; closed?: boolean }>;
type Shop = {
  shop_id: string; name: string; phone: string | null; email: string | null; address: string | null;
  description: string | null; logo_url: string | null; cover_url: string | null; qr_code_url: string | null;
  google_maps_url: string | null; website_url: string | null; facebook_url: string | null;
  instagram_url: string | null; tiktok_url: string | null; line_url: string | null;
  village: string | null; zone: string | null; soi: string | null; lat: number | null; lng: number | null;
  pickup_enabled: boolean; delivery_enabled: boolean; service_area_note: string | null;
  payment_cash_enabled: boolean; payment_qr_enabled: boolean; business_hours: Hours | null;
  is_open: boolean; is_approved: boolean; is_banned: boolean; banned_reason: string | null;
  deletion_requested_at: string | null; deletion_reason: string | null;
};
const COLS = "shop_id,name,phone,email,address,description,logo_url,cover_url,qr_code_url,google_maps_url,website_url,facebook_url,instagram_url,tiktok_url,line_url,village,zone,soi,lat,lng,pickup_enabled,delivery_enabled,service_area_note,payment_cash_enabled,payment_qr_enabled,business_hours,is_open,is_approved,is_banned,banned_reason,deletion_requested_at,deletion_reason";
const DAYS = [["mon","จันทร์"],["tue","อังคาร"],["wed","พุธ"],["thu","พฤหัสบดี"],["fri","ศุกร์"],["sat","เสาร์"],["sun","อาทิตย์"]] as const;

type Form = {
  name:string; phone:string; email:string; address:string; description:string; google_maps_url:string;
  website_url:string; facebook_url:string; instagram_url:string; tiktok_url:string; line_url:string;
  village:string; zone:string; soi:string; lat:string; lng:string; pickup_enabled:boolean; delivery_enabled:boolean;
  service_area_note:string; payment_cash_enabled:boolean; payment_qr_enabled:boolean;
  business_hours: Record<string,{open:string;close:string;closed:boolean}>;
};
function toForm(s: Shop): Form {
  const bh: Form["business_hours"] = {};
  for (const [k] of DAYS) bh[k] = { open:s.business_hours?.[k]?.open??"06:00", close:s.business_hours?.[k]?.close??"18:00", closed:!!s.business_hours?.[k]?.closed };
  return { name:s.name??"",phone:s.phone??"",email:s.email??"",address:s.address??"",description:s.description??"",google_maps_url:s.google_maps_url??"",website_url:s.website_url??"",facebook_url:s.facebook_url??"",instagram_url:s.instagram_url??"",tiktok_url:s.tiktok_url??"",line_url:s.line_url??"",village:s.village??"",zone:s.zone??"",soi:s.soi??"",lat:s.lat==null?"":String(s.lat),lng:s.lng==null?"":String(s.lng),pickup_enabled:s.pickup_enabled??true,delivery_enabled:s.delivery_enabled??true,service_area_note:s.service_area_note??"",payment_cash_enabled:s.payment_cash_enabled??true,payment_qr_enabled:s.payment_qr_enabled??false,business_hours:bh };
}

export function ShopProfileManager({ shopId }: { shopId: string }) {
  const [shop,setShop]=useState<Shop|null>(null); const [form,setForm]=useState<Form|null>(null);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [uploading,setUploading]=useState<string|null>(null); const [togglingOpen,setTogglingOpen]=useState(false);
  const [error,setError]=useState<string|null>(null); const [success,setSuccess]=useState<string|null>(null); const [deleteReason,setDeleteReason]=useState("");
  const load=useCallback(async()=>{setLoading(true); const {data,error}=await supabase.from("shops").select(COLS).eq("shop_id",shopId).maybeSingle(); if(error){setError(error.message);setLoading(false);return} const s=data as Shop|null; setShop(s); if(s)setForm(toForm(s)); setLoading(false)},[shopId]);
  useEffect(()=>{void load()},[load]);
  const set=<K extends keyof Form>(k:K,v:Form[K])=>setForm(f=>f?({...f,[k]:v}):f);
  const status=useMemo(()=>!shop?"":shop.is_banned?"ถูกระงับ":!shop.is_approved?"รออนุมัติ":shop.is_open?"เปิดร้าน":"ปิดร้าน",[shop]);
  const input=(label:string,key:keyof Form,placeholder="",type="text")=><label className="block space-y-1"><span className="text-xs font-medium text-gray-500">{label}</span><input type={type} value={String(form?.[key]??"")} onChange={e=>set(key,e.target.value as never)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"/></label>;

  async function toggleOpen(){
    if(!shop||togglingOpen)return;
    setError(null); setSuccess(null);
    if(shop.is_banned)return setError("ร้านถูกระงับ จึงไม่สามารถเปิดร้านได้");
    if(!shop.is_approved)return setError("ร้านยังไม่ได้รับการอนุมัติจากแอดมิน");
    if(shop.deletion_requested_at)return setError("ร้านมีคำขอปิด/เลิกใช้งานค้างอยู่");
    if(!shop.is_open){
      const {count,error:countErr}=await supabase.from("menu_items").select("item_id",{count:"exact",head:true}).eq("shop_id",shopId).eq("is_available",true);
      if(countErr)return setError(countErr.message);
      if(!count)return setError("ต้องมีเมนูที่พร้อมขายอย่างน้อย 1 รายการก่อนเปิดร้าน");
    }
    setTogglingOpen(true);
    const next=!shop.is_open;
    const {error:updateErr}=await supabase.from("shops").update({is_open:next}).eq("shop_id",shopId);
    setTogglingOpen(false);
    if(updateErr)return setError(updateErr.message);
    setSuccess(next?"เปิดร้านแล้ว ร้านและเมนูจะเริ่มแสดงในหน้ารวม":"ปิดร้านแล้ว");
    void load();
  }

  async function save(){if(!form)return; if(!form.name.trim())return setError("กรุณากรอกชื่อร้าน"); const lat=form.lat.trim()?Number(form.lat):null,lng=form.lng.trim()?Number(form.lng):null; if(lat!==null&&!Number.isFinite(lat))return setError("Latitude ไม่ถูกต้อง"); if(lng!==null&&!Number.isFinite(lng))return setError("Longitude ไม่ถูกต้อง"); setSaving(true);setError(null);setSuccess(null); const {error}=await supabase.from("shops").update({name:form.name.trim(),phone:form.phone.trim()||null,email:form.email.trim()||null,address:form.address.trim()||null,description:form.description.trim()||null,google_maps_url:form.google_maps_url.trim()||null,website_url:form.website_url.trim()||null,facebook_url:form.facebook_url.trim()||null,instagram_url:form.instagram_url.trim()||null,tiktok_url:form.tiktok_url.trim()||null,line_url:form.line_url.trim()||null,village:form.village.trim()||null,zone:form.zone.trim()||null,soi:form.soi.trim()||null,lat,lng,pickup_enabled:form.pickup_enabled,delivery_enabled:form.delivery_enabled,service_area_note:form.service_area_note.trim()||null,payment_cash_enabled:form.payment_cash_enabled,payment_qr_enabled:form.payment_qr_enabled,business_hours:form.business_hours}).eq("shop_id",shopId); setSaving(false); if(error)return setError(error.message); setSuccess("บันทึกข้อมูลร้านเรียบร้อย"); void load()}

  async function upload(bucket:"shop-assets"|"shop-qr-codes",kind:"logo"|"cover"|"qr",file:File){setUploading(kind);setError(null);try{const ext=safeImageExtension(file.name,kind==="qr"?"png":"jpg"); const folder=shopStorageFolder(shopId); const path=kind==="qr"?`${folder}/qr.${ext}`:`${folder}/${kind}.${ext}`; const {error:upErr}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type||"image/jpeg",upsert:true}); if(upErr)throw upErr; const {data}=supabase.storage.from(bucket).getPublicUrl(path); const url=`${data.publicUrl}?t=${Date.now()}`; const column=kind==="logo"?"logo_url":kind==="cover"?"cover_url":"qr_code_url"; const {error:dbErr}=await supabase.from("shops").update({[column]:url}).eq("shop_id",shopId); if(dbErr)throw dbErr; setSuccess("อัปโหลดเรียบร้อย"); void load()}catch(e){setError(e instanceof Error?e.message:"อัปโหลดไม่สำเร็จ")}finally{setUploading(null)}}
  function useLocation(){if(!navigator.geolocation)return setError("อุปกรณ์นี้ไม่รองรับตำแหน่ง"); navigator.geolocation.getCurrentPosition(p=>{set("lat",String(p.coords.latitude));set("lng",String(p.coords.longitude));setSuccess("นำตำแหน่งปัจจุบันมาใส่แล้ว กดบันทึกเพื่อยืนยัน")},()=>setError("ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาต Location"),{enableHighAccuracy:true,timeout:10000})}
  async function requestClosure(){if(!deleteReason.trim())return setError("กรุณาระบุเหตุผล"); const {error}=await supabase.from("shops").update({deletion_requested_at:new Date().toISOString(),deletion_reason:deleteReason.trim(),is_open:false}).eq("shop_id",shopId); if(error)return setError(error.message);setSuccess("ส่งคำขอปิดร้านแล้ว");setDeleteReason("");void load()}
  if(loading)return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>; if(!shop||!form)return <p className="p-4 text-sm text-gray-400">ไม่พบร้าน</p>;

  const statusDisabled=!shop.is_approved||shop.is_banned||!!shop.deletion_requested_at||togglingOpen;

  return <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
    <div><h1 className="text-xl font-bold">จัดการร้านค้า</h1><p className="text-sm text-gray-400">ข้อมูลร้าน โปรไฟล์ ที่ตั้ง ช่องทางติดต่อ เวลาทำการ และการชำระเงิน</p></div>
    {error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}{success&&<div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</div>}
    <section className="rounded-2xl border p-4 space-y-2"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">สถานะร้าน</h2><button type="button" onClick={()=>void toggleOpen()} disabled={statusDisabled} className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${shop.is_open?"bg-green-500 text-white":"bg-gray-100 text-gray-700"}`}>{togglingOpen?"กำลังอัปเดต...":status}</button></div><p className="text-xs text-gray-400">Shop ID: {shop.shop_id}</p>{!shop.is_approved&&<p className="text-xs text-amber-600">รอแอดมินอนุมัติก่อนเปิดร้าน</p>}{shop.deletion_requested_at&&<p className="text-xs text-red-500">มีคำขอปิด/เลิกใช้งานร้านค้างอยู่</p>}{shop.banned_reason&&<p className="text-xs text-red-500">เหตุผล: {shop.banned_reason}</p>}</section>
    <section className="rounded-2xl border p-4 space-y-3"><h2 className="font-semibold">🏪 รูปและข้อมูลพื้นฐาน</h2>{shop.cover_url&&<img src={shop.cover_url} className="h-32 w-full rounded-xl object-cover"/>}<div className="grid grid-cols-2 gap-2"><label className="rounded-xl border border-dashed p-3 text-center text-sm">{uploading==="cover"?"กำลังอัปโหลด...":"อัปโหลด Cover"}<input className="hidden" type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&void upload("shop-assets","cover",e.target.files[0])}/></label><label className="rounded-xl border border-dashed p-3 text-center text-sm">{uploading==="logo"?"กำลังอัปโหลด...":"อัปโหลด Logo"}<input className="hidden" type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&void upload("shop-assets","logo",e.target.files[0])}/></label></div>{shop.logo_url&&<img src={shop.logo_url} className="h-20 w-20 rounded-xl object-cover"/>}{input("ชื่อร้าน *","name")}<label className="block space-y-1"><span className="text-xs font-medium text-gray-500">คำอธิบายร้าน</span><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={4} className="w-full rounded-xl border p-3 text-sm" placeholder="แนะนำร้าน จุดเด่น หรือเรื่องราวของร้าน"/></label>{input("เบอร์โทร","phone","08x-xxx-xxxx","tel")}{input("อีเมล","email","shop@example.com","email")}</section>
    <section className="rounded-2xl border p-4 space-y-3"><h2 className="font-semibold">📍 ที่ตั้งร้าน</h2>{input("ที่อยู่","address")}<div className="grid grid-cols-3 gap-2">{input("หมู่บ้าน","village")}{input("โซน","zone")}{input("ซอย","soi")}</div>{input("Google Maps URL","google_maps_url","https://maps.google.com/...")}<div className="grid grid-cols-2 gap-2">{input("Latitude","lat")}{input("Longitude","lng")}</div><button onClick={useLocation} className="w-full rounded-xl bg-blue-50 py-2.5 text-sm text-blue-700">ใช้ตำแหน่งปัจจุบัน</button></section>
    <section className="rounded-2xl border p-4 space-y-3"><h2 className="font-semibold">🕒 เวลาทำการ</h2>{DAYS.map(([k,label])=>{const h=form.business_hours[k] ?? { open: "06:00", close: "18:00", closed: false };return <div key={k} className="grid grid-cols-[72px_1fr_1fr] items-center gap-2 text-sm"><label className="flex items-center gap-1"><input type="checkbox" checked={!h.closed} onChange={e=>set("business_hours",{...form.business_hours,[k]:{...h,closed:!e.target.checked}})}/>{label}</label><input type="time" disabled={h.closed} value={h.open} onChange={e=>set("business_hours",{...form.business_hours,[k]:{...h,open:e.target.value}})} className="rounded-lg border p-2 disabled:opacity-40"/><input type="time" disabled={h.closed} value={h.close} onChange={e=>set("business_hours",{...form.business_hours,[k]:{...h,close:e.target.value}})} className="rounded-lg border p-2 disabled:opacity-40"/></div>})}</section>
    <section className="rounded-2xl border p-4 space-y-3"><h2 className="font-semibold">🌐 ช่องทางออนไลน์</h2>{input("Website","website_url")}{input("LINE","line_url")}{input("Facebook","facebook_url")}{input("Instagram","instagram_url")}{input("TikTok","tiktok_url")}</section>
    <section className="rounded-2xl border p-4 space-y-3"><h2 className="font-semibold">🚚 การรับออเดอร์</h2><label className="flex justify-between text-sm">รับเองที่ร้าน (Pickup)<input type="checkbox" checked={form.pickup_enabled} onChange={e=>set("pickup_enabled",e.target.checked)}/></label><label className="flex justify-between text-sm">จัดส่ง (Delivery)<input type="checkbox" checked={form.delivery_enabled} onChange={e=>set("delivery_enabled",e.target.checked)}/></label><textarea value={form.service_area_note} onChange={e=>set("service_area_note",e.target.value)} rows={3} className="w-full rounded-xl border p-3 text-sm" placeholder="พื้นที่ให้บริการ / หมายเหตุ"/></section>
    <section className="rounded-2xl border p-4 space-y-3"><h2 className="font-semibold">💳 การชำระเงิน</h2><label className="flex justify-between text-sm">รับเงินสด<input type="checkbox" checked={form.payment_cash_enabled} onChange={e=>set("payment_cash_enabled",e.target.checked)}/></label><label className="flex justify-between text-sm">รับ QR / โอนตรงให้ร้าน<input type="checkbox" checked={form.payment_qr_enabled} onChange={e=>set("payment_qr_enabled",e.target.checked)}/></label>{shop.qr_code_url&&<img src={shop.qr_code_url} className="h-28 w-28 rounded-lg object-contain"/>}<label className="block rounded-xl border border-dashed p-3 text-center text-sm">{uploading==="qr"?"กำลังอัปโหลด...":"อัปโหลด QR Code"}<input className="hidden" type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&void upload("shop-qr-codes","qr",e.target.files[0])}/></label></section>
    <section className="rounded-2xl border p-4 space-y-2"><h2 className="font-semibold">⭐ รีวิวร้าน</h2><p className="text-sm text-gray-500">สงวนพื้นที่สำหรับระบบรีวิวลูกค้า โดยเจ้าของร้านจะดูและตอบกลับได้ แต่แก้คะแนน/ข้อความของลูกค้าไม่ได้</p></section>
    <button disabled={saving} onClick={()=>void save()} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">{saving?"กำลังบันทึก...":"บันทึกข้อมูลร้าน"}</button>
    <section className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-3"><h2 className="font-semibold text-red-700">Danger Zone</h2>{shop.deletion_requested_at?<p className="text-sm text-red-600">ส่งคำขอปิด/เลิกใช้งานร้านแล้ว</p>:<><textarea value={deleteReason} onChange={e=>setDeleteReason(e.target.value)} rows={2} className="w-full rounded-xl border border-red-100 p-3 text-sm" placeholder="เหตุผลที่ต้องการปิดร้าน"/><button onClick={()=>void requestClosure()} className="w-full rounded-xl bg-red-600 py-2.5 text-sm text-white">ส่งคำขอปิดร้าน</button></>}</section>
  </div>;
}
