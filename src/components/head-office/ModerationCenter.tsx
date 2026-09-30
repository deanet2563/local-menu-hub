const SOURCES = [
  {
    label: "Community content",
    types: "Posts · comments · groups · events · help · marketplace",
    state: "unavailable",
    detail: "ยังไม่มีตารางหรือ RPC สำหรับรายงานและสถานะ moderation",
  },
  {
    label: "Member / Shop / Rider reports",
    types: "Account · ร้านค้า · ไรเดอร์",
    state: "unavailable",
    detail: "มี lifecycle สำหรับบริหารบัญชีและ entity แต่ยังไม่มี report-to-case source",
  },
  {
    label: "Shop reviews",
    types: "Reviews · shop replies",
    state: "read-only-source",
    detail: "มีตารางรีวิว แต่ยังไม่มี visibility state, report linkage หรือ moderation history",
  },
  {
    label: "Appeals and evidence",
    types: "Appeals · attachments · case history",
    state: "unavailable",
    detail: "ยังไม่มี case/evidence/appeal model สำหรับเก็บประวัติอย่างตรวจสอบได้",
  },
] as const;

function StateBadge({ state }: { state: (typeof SOURCES)[number]["state"] }) {
  const unavailable = state === "unavailable";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${unavailable ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
      {unavailable ? "Unavailable" : "Read-only source"}
    </span>
  );
}

export function ModerationCenter() {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-emerald-700">Moderation &amp; Safety Center</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Report queue</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              คิวรายงานยังใช้งานไม่ได้ เพราะ Production ยังไม่มี report source ที่ยืนยันได้
              หน้านี้จะไม่สร้าง case หรือตัวเลขแทนข้อมูลจริง
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
            Queue unavailable
          </span>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6" role="status">
        <h3 className="font-semibold text-amber-950">ยังไม่มีรายงานให้ triage</h3>
        <p className="mt-1 text-sm leading-6 text-amber-900">
          ตรวจพบชื่อ <code className="rounded bg-amber-100 px-1">moderation_reports</code> ใน UI เก่า
          แต่ไม่มีตารางนี้ใน Production schema ปัจจุบัน จึงไม่ใช้ UI เก่านั้นเป็นแหล่งข้อมูลหรือแสดงรายการสมมติ
        </p>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h3 className="font-semibold text-gray-900">แหล่งข้อมูลที่ตรวจพบ</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            สถานะอ้างอิง Production schema ที่ตรวจสอบสำหรับ baseline ของ Wave 5
          </p>
        </div>
        <ul className="divide-y divide-gray-100">
          {SOURCES.map((source) => (
            <li key={source.label} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium text-gray-900">{source.label}</h4>
                  <StateBadge state={source.state} />
                </div>
                <p className="mt-1 text-xs text-gray-500">{source.types}</p>
                <p className="mt-2 text-sm leading-5 text-gray-600">{source.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-semibold text-gray-900">การดำเนินการถูกปิดไว้</h3>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          ยังไม่มี canonical visibility/enforcement contract ที่ customer surfaces ใช้ร่วมกัน
          รวมถึงยังไม่มี case history และหลักฐานที่ตรวจสอบย้อนหลังได้ จึงยังไม่เปิด hide, remove, restore,
          warning, restriction, ban หรือ appeal action จากหน้านี้
        </p>
        <p className="mt-3 text-xs leading-5 text-gray-500">
          เมื่อเชื่อม report source และ contract แล้ว คิวจึงจะเปิด search, filters, assignment, sort และ pagination
          จาก field ที่มีจริง พร้อมจำกัดข้อมูลผู้รายงานตาม permission
        </p>
      </section>
    </div>
  );
}
