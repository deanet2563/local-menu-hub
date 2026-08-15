// ============================================================
// MyTree — Rider Signup (food delivery only)
//
// Product/legal scope for pilot:
// - Rider accounts are for food delivery only.
// - No passenger transport and no errand service are offered by MyTree.
// - Keep legacy rider_class/service columns populated conservatively for
//   backward compatibility; the UI does not expose those capabilities.
// ============================================================

import { useState, useEffect } from "react";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";
import { linkRichMenu } from "@/lib/richmenu";

export function RiderSignupForm() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("มอเตอร์ไซค์");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) {
          setAuthError("กรุณาเปิดหน้านี้ผ่าน LINE (LIFF) เพื่อเข้าสู่ระบบก่อนสมัคร");
          return;
        }
        setCustomerId(cid);
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : "เข้าสู่ระบบ LINE ไม่สำเร็จ");
      }
    })();
  }, []);

  async function handleGetLocation() {
    setLocating(true);
    setError(null);
    try {
      setLocation(await getCurrentLocation());
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLocating(false);
    }
  }

  function validate(): string | null {
    if (!customerId) return "ยังไม่ได้เข้าสู่ระบบ LINE — เปิดผ่าน LINE แล้วลองใหม่";
    if (!name.trim() || !phone.trim()) return "กรอกชื่อและเบอร์โทรให้ครบ";
    if (!location) return "ต้องกดแชร์ตำแหน่งก่อนสมัคร";
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: riderError } = await supabase.from("riders").insert({
      customer_id: customerId,
      name: name.trim(),
      phone: phone.trim(),
      vehicle_type: vehicleType,
      rider_class: "general",
      offers_delivery: true,
      offers_errand: false,
      offers_passenger: false,
      plate_number: null,
      win_registration_no: null,
      win_zone: null,
      lat: location!.lat,
      lng: location!.lng,
      location_updated_at: new Date().toISOString(),
    });

    setSubmitting(false);
    if (riderError) {
      setError(riderError.code === "23505" ? "บัญชีนี้สมัครเป็นไรเดอร์ไว้แล้ว" : riderError.message);
      return;
    }

    void linkRichMenu("rider");
    setDone(true);
  }

  if (authError) {
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</p>
        <p className="text-sm text-gray-500">{authError}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">✅ สมัครเรียบร้อย</p>
        <p className="text-sm text-gray-500">รอแอดมินอนุมัติก่อนเริ่มรับงานส่งอาหาร</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-lg font-semibold">🛵 สมัครเป็นไรเดอร์ส่งอาหาร</h1>
        <p className="mt-1 text-xs text-gray-500">MyTree เปิดให้ไรเดอร์รับงานส่งอาหารเท่านั้น</p>
      </div>

      {!customerId && <p className="text-xs text-gray-400">กำลังเข้าสู่ระบบ LINE...</p>}

      <input
        className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        placeholder="ชื่อ-นามสกุล"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        placeholder="เบอร์โทร"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">พาหนะที่ใช้ส่งอาหาร</p>
        <select
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
        >
          <option value="มอเตอร์ไซค์">มอเตอร์ไซค์</option>
          <option value="จักรยาน">จักรยาน</option>
          <option value="รถยนต์">รถยนต์</option>
        </select>
      </div>

      <div className="rounded-lg border border-green-200 bg-green-50/60 p-3">
        <p className="text-sm font-medium text-green-800">บริการที่เปิดใช้งาน</p>
        <p className="mt-1 text-sm text-green-700">🍱 ส่งอาหาร (Food Delivery)</p>
        <p className="mt-1 text-xs text-gray-500">ไม่มีบริการรับส่งผู้โดยสารหรือรับงานประเภทอื่นในระบบ MyTree</p>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm text-gray-600">📍 ตำแหน่งปัจจุบัน (จำเป็น — ใช้จัดลำดับไรเดอร์ใกล้ร้าน)</p>
        {location ? (
          <p className="text-sm text-green-600">✅ ได้ตำแหน่งแล้ว ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</p>
        ) : (
          <button
            onClick={handleGetLocation}
            disabled={locating}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium"
          >
            {locating ? "กำลังค้นหา..." : "📍 แชร์ตำแหน่ง"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || !customerId}
        className="w-full rounded-lg bg-orange-500 py-3 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "สมัครเป็นไรเดอร์ส่งอาหาร"}
      </button>
    </div>
  );
}
