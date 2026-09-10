import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/favorites")({
  component: FavoritesPage,
});

function FavoritesPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f3] px-4 py-6 pb-24 text-slate-900">
      <main className="mx-auto max-w-md space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-700">MyTree</p>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">พื้นที่รายการโปรดกำลังเตรียมสำหรับ MyTree Community Thailand</p>
          <Link to="/" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-emerald-700 px-5 text-sm font-bold text-white">กลับหน้าแรก</Link>
        </section>
      </main>
    </div>
  );
}
