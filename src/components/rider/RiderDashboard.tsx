// ============================================================
// MyTree — Rider Dashboard
// Online/offline toggle + location refresh + status + (post-verification)
// enable passenger service.
//
// การอัปเดตตำแหน่งผ่าน LINE chat (#location) จะทำได้เต็มที่เมื่อ Webhook
// server เสร็จก่อน ตอนนี้ใช้ปุ่มนี้แทน
// ============================================================

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geolocation";

type RiderRow = {
  id: string;
  name: string;
  rider_class: "public_win" | "general";
  is_online: boolean;
  is_approved: boolean;
  verified_at: string | null;
  offers_delivery: boolean;
  offers_errand: boolean;
  offers_passenger: boolean;
  plate_number: string | null;
  win_registration_no: string | null;
  lat: number | null;
  lng: number | null;
  location_updated_at: string | null;
};

const RIDER_COLS =
  "id, name, rider_class, is_online, is_approved, verified_at, offers_delivery, offers_errand, offers_passenger, plate_number, win_registration_no, lat, lng, location_updated_at";

export function RiderDashboard({ riderId }: { riderId: string }) {
  const [rider, setRider] = useState<RiderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("riders")
      .select(RIDER_COLS)
      .eq("id", riderId)
      .single();
    if (error) setError(error.message);
    setRider((data as RiderRow) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  async function toggleOnline() {
    if (!rider) return;
    const { error } = await supabase
      .from("riders")
      .update({ is_online: !rider.is_online })
      .eq("id", riderId);
    if (error) return setError(error.message);
    load();
  }

  async function togglePassenger() {
    if (!rider) return;
    // Guarded by DB constraint: will fail unless public_win + verified + docs present
    const { error } = await supabase
      .from("riders")
      .update({ offers_passenger: !rider.offers_passenger })
      .eq("id", riderId);
    if (error) {
      setError("เปิดรับผู้โดยสารไม่ได้ — ต้องเป็นวินป้ายเหลืองที่ยืนยันเอกสารแล้ว");
      return;
    }
    load();
  }

  async function updateLocation() {
    setUpdatingLocation(true);
    setError(null);
    try {
      const loc = await getCurrentLocation();
      const { error } = await supabase
        .from("riders")
        .update({ lat: loc.lat, lng: loc.lng, location_updated_at: new Date().toISOString() })
        .eq("id", riderId);
      if (error) throw error;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setUpdatingLocation(false);
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;
  if (!rider) return <p className="p-4 text-sm text-gray-400">ไม่พบข้อมูลวิน</p>;

  const isWin = rider.rider_class === "public_win";
  const canEnablePassenger = isWin && rider.verified_at != null;

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-lg font-semibold">🛵 {rider.name}</h1>

      {!rider.is_approved && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          ⏳ รอแอดมิน approve อยู่ — ร้านยังมองไม่เห็นคุณใน directory จนกว่าจะ approve
        </div>
      )}

      {isWin && rider.verified_at == null && rider.plate_number && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          📄 เอกสารป้ายเหลืองอยู่ระหว่างตรวจสอบ — รับผู้โดยสารได้หลังยืนยันแล้ว
        </div>
      )}

      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">สถานะ</span>
          <button
            onClick={toggleOnline}
            disabled={!rider.is_approved}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              rider.is_online ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"
            } disabled:opacity-50`}
          >
            {rider.is_online ? "🟢 ออนไลน์" : "⚪ ออฟไลน์"}
          </button>
        </div>

        {/* services */}
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-sm font-medium text-gray-600">บริการที่ให้</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {rider.offers_delivery && <span className="rounded-full bg-gray-100 px-2 py-1">ส่งของ</span>}
            {rider.offers_errand && <span className="rounded-full bg-gray-100 px-2 py-1">รับธุระ</span>}
            {rider.offers_passenger && <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">รับผู้โดยสาร</span>}
          </div>
          {canEnablePassenger && (
            <button
              onClick={togglePassenger}
              className="mt-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium"
            >
              {rider.offers_passenger ? "ปิดรับผู้โดยสาร" : "✅ เปิดรับผู้โดยสาร (ยืนยันแล้ว)"}
            </button>
          )}
        </div>

        {/* location */}
        <div className="border-t border-gray-100 pt-3 space-y-1">
          <p className="text-sm text-gray-500">
            ตำแหน่งล่าสุด:{" "}
            {rider.lat && rider.lng ? `${rider.lat.toFixed(4)}, ${rider.lng.toFixed(4)}` : "ยังไม่มีข้อมูล"}
          </p>
          {rider.location_updated_at && (
            <p className="text-xs text-gray-400">
              อัปเดตล่าสุด:{" "}
              {new Date(rider.location_updated_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
            </p>
          )}
          <button
            onClick={updateLocation}
            disabled={updatingLocation}
            className="mt-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium"
          >
            {updatingLocation ? "กำลังอัปเดต..." : "📍 อัปเดตตำแหน่งตอนนี้"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
