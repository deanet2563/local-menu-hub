import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});

function CommunityPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f3] px-4 py-6 pb-24 text-slate-900">
      <main className="mx-auto max-w-md space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-700">MyTree</p>
        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">ชุมชน MyTree</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            กำลังเตรียมพื้นที่สำหรับข่าวสาร เพื่อนบ้าน และกิจกรรมในชุมชน
          </p>
        </section>
      </main>
    </div>
  );
}
