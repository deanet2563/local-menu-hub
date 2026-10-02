import { Link } from "@tanstack/react-router";

/** Lightweight MyTree landing page. Food discovery lives on the dedicated /hub route. */
export function MyTreeHome() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-3.5rem)] max-w-xl space-y-6 bg-white px-5 pb-24 pt-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-800">MyTree Community Thailand</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">MyTree ใกล้บ้าน</h1>
        <p className="max-w-prose text-sm leading-6 text-gray-600">ค้นหาร้านและสถานที่ในชุมชนของคุณ พร้อมเลือกเส้นทางไปยังบริการที่ต้องการ</p>
      </header>

      <section aria-label="บริการ MyTree" className="grid gap-3">
        <Link to="/hub" className="flex items-center justify-between rounded-2xl bg-orange-500 p-5 text-white shadow-sm">
          <span>
            <span className="block text-lg font-bold">สั่งอาหารใกล้บ้าน</span>
            <span className="mt-1 block text-sm text-orange-50">เลือกร้านและเมนูจาก Food Hub</span>
          </span>
          <span aria-hidden="true" className="text-2xl">→</span>
        </Link>
        <Link to="/map" search={{ shop: undefined }} className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 p-5 text-green-950">
          <span>
            <span className="block text-lg font-bold">ดูแผนที่ชุมชน</span>
            <span className="mt-1 block text-sm text-green-800">ร้านค้าและสถานที่สาธารณะที่ผ่านการยืนยัน</span>
          </span>
          <span aria-hidden="true" className="text-2xl">⌖</span>
        </Link>
      </section>

      <section className="rounded-2xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900">บริการของฉัน</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Link to="/orders" className="rounded-xl bg-gray-50 p-3 text-gray-800">ติดตามออเดอร์</Link>
          <Link to="/account" className="rounded-xl bg-gray-50 p-3 text-gray-800">ข้อมูลบัญชี</Link>
        </div>
      </section>
    </main>
  );
}
