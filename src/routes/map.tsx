import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f3] px-4 py-6 pb-24 text-slate-900">
      <main className="mx-auto max-w-md space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-700">MyTree</p>
        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">แผนที่ชุมชน</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            เตรียมพื้นที่สำหรับ Community Map โดยไม่เปลี่ยน Google Maps logic ใน Gate นี้
          </p>
        </section>
      </main>
    </div>
  );
}
