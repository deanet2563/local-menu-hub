import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/community")({
  component: CommunityRoute,
});

function CommunityRoute() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <h1 className="text-xl font-bold">ชุมชน</h1>
      <p className="mt-2 text-sm text-slate-500">พื้นที่ชุมชนกำลังเตรียมเปิดใช้งาน</p>
    </main>
  );
}
