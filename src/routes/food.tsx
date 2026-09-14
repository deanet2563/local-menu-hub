import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/food")({
  component: FoodRoute,
});

function FoodRoute() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <h1 className="text-xl font-bold">อาหาร</h1>
      <p className="mt-2 text-sm text-slate-500">เลือกอาหารจากหน้าแรกของ MyTree ได้ตามปกติ</p>
      <Link to="/" className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white">กลับหน้าแรก</Link>
    </main>
  );
}
