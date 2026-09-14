import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/map")({
  component: MapRoute,
});

function MapRoute() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <h1 className="text-xl font-bold">แผนที่</h1>
      <p className="mt-2 text-sm text-slate-500">แผนที่ชุมชนกำลังเตรียมเปิดใช้งาน</p>
    </main>
  );
}
