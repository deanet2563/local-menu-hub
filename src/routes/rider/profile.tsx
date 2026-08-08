import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentCustomerId, initLiff, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/rider/profile")({
  component: RiderProfilePage,
});

type Rider = {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string | null;
  rider_class: "public_win" | "general";
  plate_number: string | null;
  win_registration_no: string | null;
  win_zone: string | null;
  is_approved: boolean;
  is_banned: boolean;
  verified_at: string | null;
};

function RiderProfilePage() {
  const [rider, setRider] = useState<Rider | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [registration, setRegistration] = useState("");
  const [zone, setZone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const cid = await getCurrentCustomerId();
        if (!cid) return;

        const { data, error } = await supabase
          .from("riders")
          .select("id,name,phone,vehicle_type,rider_class,plate_number,win_registration_no,win_zone,is_approved,is_banned,verified_at")
          .eq("customer_id", cid)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const row = data as Rider;
        setRider(row);
        setName(row.name ?? "");
        setPhone(row.phone ?? "");
        setVehicle(row.vehicle_type ?? "");
        setPlate(row.plate_number ?? "");
        setRegistration(row.win_registration_no ?? "");
        setZone(row.win_zone ?? "");
      } catch {
        setMessage("โหลดข้อมูลไรเดอร์ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!rider) return;

    setSaving(true);
    setMessage("");

    const patch: Record<string, string | null> = {
      name: name.trim(),
      phone: phone.trim(),
      vehicle_type: vehicle.trim() || null,
    };

    // Verified public-win identity fields are locked.
    // Changing them must go through admin re-verification.
    if (rider.rider_class === "public_win" && !rider.verified_at) {
      patch.plate_number = plate.trim() || null;
      patch.win_registration_no = registration.trim() || null;
      patch.win_zone = zone.trim() || null;
    }

    const { error } = await supabase
      .from("riders")
      .update(patch)
      .eq("id", rider.id);

    setSaving(false);
    setMessage(
      error ? `บันทึกไม่สำเร็จ: ${error.message}` : "บันทึกข้อมูลเรียบร้อยแล้ว"
    );
  }

  if (loading)
    return <p className="p-4 text-sm text-gray-400">กำลังโหลด...</p>;

  if (!rider)
    return (
      <div className="p-6 text-center space-y-3">
        <p>ยังไม่พบข้อมูลไรเดอร์</p>
        <Link to="/rider/signup" className="text-orange-500 underline">
          สมัครเป็นไรเดอร์
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-bold">จัดการข้อมูลของฉัน</h1>
        <p className="text-sm text-gray-500">Rider Profile</p>
      </div>

      {rider.is_banned && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          บัญชีไรเดอร์นี้ถูกระงับ
        </div>
      )}

      <form
        onSubmit={save}
        className="space-y-3 rounded-xl border border-gray-200 p-4"
      >
        <input
          className="w-full rounded-lg border p-2 text-sm"
          placeholder="ชื่อ"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full rounded-lg border p-2 text-sm"
          placeholder="เบอร์โทร"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          className="w-full rounded-lg border p-2 text-sm"
          placeholder="ประเภทรถ"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
        />

        {rider.rider_class === "public_win" && (
          <>
            <input
              className="w-full rounded-lg border p-2 text-sm"
              placeholder="ทะเบียนรถ"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />

            <input
              className="w-full rounded-lg border p-2 text-sm"
              placeholder="เลขทะเบียนวิน"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
            />

            <input
              className="w-full rounded-lg border p-2 text-sm"
              placeholder="พื้นที่วิน"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            />
          </>
        )}

        <button
          disabled={saving || rider.is_banned}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลไรเดอร์"}
        </button>

        {message && <p className="text-sm text-gray-600">{message}</p>}
      </form>

      <Link
        to="/rider"
        className="block rounded-lg bg-gray-100 px-3 py-2 text-center text-sm"
      >
        กลับไปงานไรเดอร์
      </Link>
    </div>
  );
}
