import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/food")({ component: FoodPage });

function FoodPage() {
  return <main className="customer-bottom-safe-padding min-h-screen bg-[#f7f7f3] px-4 py-5 text-slate-900"><section className="mx-auto max-w-md space-y-4"><div><p className="text-2xl font-bold">อาหาร</p><p className="mt-1 text-sm text-slate-500">เมนูอาหารยังอยู่ที่หน้าแรกระหว่าง Phase 1B</p></div><Link to="/" className="block rounded-2xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white">กลับหน้าแรก</Link></section></main>;
}
