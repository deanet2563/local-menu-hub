import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";

// ============================================================
// MyTree — Shop onboarding (5 fields, per original spec):
//  1. ชื่อร้าน + หมวดอาหาร
//  2. เบอร์โทร
//  3. เวลาเปิด-ปิด + open_days
//  4. Google Maps link + พื้นที่ส่ง
//  5. โลโก้/รูปร้าน (URL for now — file upload is a later enhancement)
//
// Calls fn_register_shop (SECURITY DEFINER) which atomically creates the
// shop + makes the caller its owner. customer_id comes from the LINE
// session, never from client input.
// ============================================================

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "จ" }, { key: "tue", label: "อ" }, { key: "wed", label: "พ" },
  { key: "thu", label: "พฤ" }, { key: "fri", label: "ศ" }, { key: "sat", label: "ส" }, { key: "sun", label: "อา" },
];

export function ShopSignupForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [openDays, setOpenDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [mapsLink, setMapsLink] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: string) =>
    setOpenDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  async function useMyLocation() {
    setLocating(true);
    try {
      setLocation(await getCurrentLocation());
    } catch (e) {
      setError(e instanceof Error ? e.message : "หาตำแหน่งไม่สำเร็จ");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setError("กรอกชื่อร้าน"); return; }
    if (openDays.length === 0) { setError("เลือกวันเปิดร้านอย่างน้อย 1 วัน"); return; }

    setSubmitting(true);
    setError(null);
    try {
      await initLiff();
      const cid = await getCurrentCustomerId();
      if (!cid) { setError("กรุณาเข้าสู่ระบบผ่าน LINE ก่อนสมัครร้าน"); setSubmitting(false); return; }

      const { data, error: rpcErr } = await supabase.rpc("fn_register_shop", {
        p_name: name.trim(),
        p_category: category.trim() || null,
        p_phone: phone.trim() || null,
        p_open_time: openTime || null,
        p_close_time: closeTime || null,
        p_open_days: openDays,
        p_google_maps_link: mapsLink.trim() || null,
        p_delivery_zone: deliveryZone.trim() || null,
        p_logo_url: logoUrl.trim() || null,
        p_lat: location?.lat ?? null,
        p_lng: location?.lng ?? null,
      });
      if (rpcErr) throw rpcErr;

      const shopId = Array.isArray(data) ? data[0]?.shop_id : (data as any)?.shop_id;
      navigate({ to: "/sweet/menu", search: { welcome: 1 } as any });
      void shopId;
    } catch (e: any) {
      setError(e?.message ?? "สมัครร้านไม่สำเร็จ");
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-8">
      <h1 className="text-lg font-semibold">🏪 สมัครร้านค้าใหม่</h1>
      <p className="text-xs text-gray-400">
        กรอกข้อมูลร้าน แล้วไปเพิ่มเมนูได้ทันที ร้านจะเริ่มต้นเป็น "ปิด" — เปิดได้เองหลังใส่เมนูเสร็จ
      </p>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">1. ชื่อร้าน + หมวดอาหาร</p>
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ชื่อร้าน" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="หมวด เช่น อาหารตามสั่ง, เครื่องดื่ม" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">2. เบอร์โทรติดต่อ</p>
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">3. เวลาเปิด-ปิด</p>
        <div className="flex gap-2">
          <input type="time" className="flex-1 rounded-lg border border-gray-200 p-2 text-sm" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
          <input type="time" className="flex-1 rounded-lg border border-gray-200 p-2 text-sm" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {DAYS.map((d) => (
            <button key={d.key} onClick={() => toggleDay(d.key)}
              className={`flex-1 rounded-lg py-1.5 text-xs ${openDays.includes(d.key) ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500"}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">4. ตำแหน่งร้าน + พื้นที่ส่ง</p>
        {location ? (
          <p className="text-sm text-green-600">✅ ได้ตำแหน่งแล้ว ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</p>
        ) : (
          <button onClick={useMyLocation} disabled={locating} className="rounded-lg bg-gray-100 px-4 py-2 text-sm">
            {locating ? "กำลังค้นหา..." : "📍 ใช้ตำแหน่งปัจจุบันของร้าน"}
          </button>
        )}
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="Google Maps link (ไม่บังคับ)" value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} />
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="พื้นที่ส่ง เช่น หมู่บ้านสัมมากร" value={deliveryZone} onChange={(e) => setDeliveryZone(e.target.value)} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">5. โลโก้/รูปร้าน</p>
        <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ลิงก์รูปโลโก้ (ไม่บังคับ — ใส่ทีหลังได้)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting} className="w-full rounded-lg bg-orange-500 text-white py-3 text-sm font-medium disabled:opacity-50">
        {submitting ? "กำลังสมัคร..." : "สมัครร้านค้า"}
      </button>
    </div>
  );
}
