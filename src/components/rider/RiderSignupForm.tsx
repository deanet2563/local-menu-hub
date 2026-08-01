// ============================================================
// MyTree — Rider Signup (mandatory GPS, requires admin approval)
//
// Matches DB schema (riders table + compliance constraints):
//  - rider_class: 'public_win' (วินป้ายเหลือง) | 'general' (ส่งของ/ธุระเท่านั้น)
//  - service flags: offers_delivery / offers_errand / offers_passenger
//  - passenger service is NEVER enabled at signup: the DB constraint
//    chk_passenger_requires_verified_win blocks offers_passenger=true until a
//    public_win rider has verified_at + plate_number + win_registration_no.
//    So we only COLLECT the yellow-plate documents here; an admin verifies
//    them later (fn_verify_rider_document), then the rider enables passenger
//    service from their dashboard.
// ============================================================

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";

type RiderClass = "public_win" | "general";

export function RiderSignupForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("มอเตอร์ไซค์");
  const [riderClass, setRiderClass] = useState<RiderClass>("general");

  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersErrand, setOffersErrand] = useState(false);
  const [wantsPassenger, setWantsPassenger] = useState(false); // intent only

  // yellow-plate documents (public_win)
  const [plateNumber, setPlateNumber] = useState("");
  const [winRegistrationNo, setWinRegistrationNo] = useState("");
  const [winZone, setWinZone] = useState("");

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isWin = riderClass === "public_win";

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
    if (!name.trim() || !phone.trim()) return "กรอกชื่อและเบอร์โทรให้ครบ";
    if (!location) return "ต้องกดแชร์ตำแหน่งก่อนสมัคร — ระบบใช้หาว่าวินอยู่ใกล้ร้านไหน";
    if (!offersDelivery && !offersErrand && !(isWin && wantsPassenger))
      return "เลือกบริการที่ให้อย่างน้อย 1 อย่าง";
    if (isWin && wantsPassenger && (!plateNumber.trim() || !winRegistrationNo.trim()))
      return "รับผู้โดยสารต้องกรอกทะเบียนรถและเลขวิน/ใบอนุญาตขับขี่สาธารณะ";
    return null;
  }

  async function handleSubmit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);

    // TODO(auth): customer_id ที่ถูกต้องต้องมาจาก LINE login session จริง
    // (รอ auth/JWT flow) ตอนนี้สร้าง customer ใหม่ทุกครั้งไปก่อนเป็น placeholder
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({ name, phone })
      .select("id")
      .single();

    if (customerError || !customer) {
      setError(customerError?.message ?? "สร้างบัญชีไม่สำเร็จ");
      setSubmitting(false);
      return;
    }

    // offers_passenger is ALWAYS false at signup (constraint) — enabled later after verification
    const { error: riderError } = await supabase.from("riders").insert({
      customer_id: customer.id,
      name,
      phone,
      vehicle_type: vehicleType,
      rider_class: riderClass,
      offers_delivery: offersDelivery,
      offers_errand: offersErrand,
      offers_passenger: false,
      plate_number: isWin ? plateNumber.trim() || null : null,
      win_registration_no: isWin ? winRegistrationNo.trim() || null : null,
      win_zone: isWin ? winZone.trim() || null : null,
      lat: location!.lat,
      lng: location!.lng,
      location_updated_at: new Date().toISOString(),
    });

    setSubmitting(false);
    if (riderError) {
      setError(riderError.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">✅ สมัครเรียบร้อย</p>
        <p className="text-sm text-gray-500">
          รอแอดมิน approve ก่อน — จะแจ้งผลให้ทราบทาง LINE
        </p>
        {isWin && wantsPassenger && (
          <p className="text-sm text-amber-600">
            บริการรับผู้โดยสารจะเปิดใช้ได้หลังแอดมินตรวจเอกสารป้ายเหลืองแล้วเท่านั้น
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-lg font-semibold">🛵 สมัครเป็นวินส่งของ</h1>

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
      <select
        className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        value={vehicleType}
        onChange={(e) => setVehicleType(e.target.value)}
      >
        <option value="มอเตอร์ไซค์">มอเตอร์ไซค์</option>
        <option value="จักรยาน">จักรยาน</option>
        <option value="รถยนต์">รถยนต์</option>
      </select>

      {/* rider class */}
      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">ประเภทผู้ให้บริการ</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="rider_class"
            checked={riderClass === "general"}
            onChange={() => {
              setRiderClass("general");
              setWantsPassenger(false);
            }}
          />
          <span>
            ผู้ให้บริการทั่วไป — <span className="text-gray-500">ส่งของ / ทำธุระเท่านั้น</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="rider_class"
            checked={riderClass === "public_win"}
            onChange={() => setRiderClass("public_win")}
          />
          <span>
            วินป้ายเหลือง — <span className="text-gray-500">รับผู้โดยสารได้ (ต้องยืนยันเอกสาร)</span>
          </span>
        </label>
      </div>

      {/* services */}
      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">บริการที่ให้</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={offersDelivery} onChange={(e) => setOffersDelivery(e.target.checked)} />
          ส่งของ (delivery)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={offersErrand} onChange={(e) => setOffersErrand(e.target.checked)} />
          รับธุระ (errand)
        </label>
        {isWin && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wantsPassenger} onChange={(e) => setWantsPassenger(e.target.checked)} />
            รับผู้โดยสาร <span className="text-xs text-amber-600">(เปิดหลังยืนยันเอกสาร)</span>
          </label>
        )}
      </div>

      {/* yellow-plate documents */}
      {isWin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-800">เอกสารป้ายเหลือง</p>
          <p className="text-xs text-gray-500">
            จำเป็นถ้าจะรับผู้โดยสาร — แอดมินจะตรวจก่อนเปิดใช้
          </p>
          <input
            className="w-full rounded-lg border border-gray-200 p-2 text-sm"
            placeholder="ทะเบียนรถ (เช่น กก 1234)"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-gray-200 p-2 text-sm"
            placeholder="เลขวิน / เลขที่ใบอนุญาตขับขี่สาธารณะ"
            value={winRegistrationNo}
            onChange={(e) => setWinRegistrationNo(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-gray-200 p-2 text-sm"
            placeholder="ซอย / วินที่สังกัด (ไม่บังคับ)"
            value={winZone}
            onChange={(e) => setWinZone(e.target.value)}
          />
        </div>
      )}

      {/* location */}
      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm text-gray-600">📍 ตำแหน่งปัจจุบัน (จำเป็น — ใช้หาว่าคุณอยู่ใกล้ร้านไหน)</p>
        {location ? (
          <p className="text-sm text-green-600">
            ✅ ได้ตำแหน่งแล้ว ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
          </p>
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
        disabled={submitting}
        className="w-full rounded-lg bg-orange-500 py-3 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "สมัครเลย"}
      </button>
    </div>
  );
}
