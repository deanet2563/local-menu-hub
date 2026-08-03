// ============================================================
// MyTree — Rider Signup (uses the LINE-authenticated customer_id)
//
// FIX: no longer inserts a `customers` row from the client (RLS blocks that).
// Instead it takes the customer_id from the LINE session (broker-minted JWT)
// and inserts ONLY the riders row, which the rider_inserts_own_row policy
// allows because customer_id == the JWT claim.
// ============================================================

import { useState, useEffect } from "react";
import { supabase, getCurrentCustomerId, initLiff } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";

type RiderClass = "public_win" | "general";

export function RiderSignupForm() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("มอเตอร์ไซค์");
  const [riderClass, setRiderClass] = useState<RiderClass>("general");

  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersErrand, setOffersErrand] = useState(false);
  const [wantsPassenger, setWantsPassenger] = useState(false);

  const [plateNumber, setPlateNumber] = useState("");
  const [winRegistrationNo, setWinRegistrationNo] = useState("");
  const [winZone, setWinZone] = useState("");

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isWin = riderClass === "public_win";

  // Resolve the LINE-authenticated customer_id on mount (logs in via LINE if needed).
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

    // Insert ONLY the rider row, tied to the LINE-authed customer_id.
    // offers_passenger stays false at signup (enabled later after verification).
    const { error: riderError } = await supabase.from("riders").insert({
      customer_id: customerId,
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
      // e.g. duplicate (already a rider) -> unique(customer_id)
      setError(
        riderError.code === "23505"
          ? "บัญชีนี้สมัครเป็นวินไว้แล้ว"
          : riderError.message
      );
      return;
    }
    setDone(true);
  }

  if (authError) {
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">🔒 ต้องเข้าสู่ระบบ LINE ก่อน</p>
        <p className="text-sm text-gray-500">{authError}</p>
        <p className="text-xs text-gray-400 break-all">
          เปิดผ่าน: https://liff.line.me/2010936243-3kPykppE/rider/signup
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="p-6 text-center space-y-2 max-w-md mx-auto">
        <p className="text-lg font-semibold">✅ สมัครเรียบร้อย</p>
        <p className="text-sm text-gray-500">รอแอดมิน approve ก่อน — จะแจ้งผลทาง LINE</p>
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
      {!customerId && (
        <p className="text-xs text-gray-400">กำลังเข้าสู่ระบบ LINE...</p>
      )}

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

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">ประเภทผู้ให้บริการ</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="rider_class" checked={riderClass === "general"}
            onChange={() => { setRiderClass("general"); setWantsPassenger(false); }} />
          <span>ผู้ให้บริการทั่วไป — <span className="text-gray-500">ส่งของ / ทำธุระเท่านั้น</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="rider_class" checked={riderClass === "public_win"}
            onChange={() => setRiderClass("public_win")} />
          <span>วินป้ายเหลือง — <span className="text-gray-500">รับผู้โดยสารได้ (ต้องยืนยันเอกสาร)</span></span>
        </label>
      </div>

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

      {isWin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-800">เอกสารป้ายเหลือง</p>
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ทะเบียนรถ (เช่น กก 1234)"
            value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="เลขวิน / เลขที่ใบอนุญาตขับขี่สาธารณะ"
            value={winRegistrationNo} onChange={(e) => setWinRegistrationNo(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 p-2 text-sm" placeholder="ซอย / วินที่สังกัด (ไม่บังคับ)"
            value={winZone} onChange={(e) => setWinZone(e.target.value)} />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-sm text-gray-600">📍 ตำแหน่งปัจจุบัน (จำเป็น — ใช้หาว่าคุณอยู่ใกล้ร้านไหน)</p>
        {location ? (
          <p className="text-sm text-green-600">✅ ได้ตำแหน่งแล้ว ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</p>
        ) : (
          <button onClick={handleGetLocation} disabled={locating}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium">
            {locating ? "กำลังค้นหา..." : "📍 แชร์ตำแหน่ง"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting || !customerId}
        className="w-full rounded-lg bg-orange-500 py-3 font-medium text-white disabled:opacity-50">
        {submitting ? "กำลังบันทึก..." : "สมัครเลย"}
      </button>
    </div>
  );
}
