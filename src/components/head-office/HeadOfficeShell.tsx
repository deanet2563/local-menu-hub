import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  HEAD_OFFICE_SECTIONS,
  getHeadOfficeSection,
  type HeadOfficeSection,
} from "./headOfficeNav";

export function HeadOfficeShell({
  section,
  children,
}: {
  section: HeadOfficeSection;
  children?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = getHeadOfficeSection(section);

  useEffect(() => {
    setMobileOpen(false);
  }, [section]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <a
        href="#head-office-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        ข้ามไปยังเนื้อหา
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <SidebarContent section={section} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-gray-950/35"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-[min(88vw,20rem)] border-r border-gray-200 bg-white shadow-xl">
            <SidebarContent section={section} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label="เปิดเมนู Head Office"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl lg:hidden"
            >
              ☰
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">MyTree System Admin</p>
              <h1 className="truncate text-lg font-semibold">{active.label}</h1>
            </div>
            <Link
              to="/sweet/admin"
              className="hidden rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:inline-flex"
            >
              Legacy Admin
            </Link>
          </div>
        </header>

        <main id="head-office-content" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1600px]">
            <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm text-gray-500">
              <Link to="/head-office" className="hover:text-gray-900">Head Office</Link>
              {section !== "overview" && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="font-medium text-gray-900" aria-current="page">{active.label}</span>
                </>
              )}
            </nav>
            {children ?? <HeadOfficePlaceholder section={section} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  section,
  onClose,
}: {
  section: HeadOfficeSection;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-5">
        <Link to="/head-office" className="min-w-0 flex-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300">
          <p className="text-xl font-bold tracking-tight">MyTree</p>
          <p className="mt-0.5 text-xs text-gray-500">Head Office</p>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู Head Office"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg text-gray-600"
          >
            ×
          </button>
        )}
      </div>
      <nav aria-label="Head Office navigation" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {HEAD_OFFICE_SECTIONS.map((item) => {
            const isActive = item.key === section;
            return (
              <li key={item.key}>
                {item.key === "overview" ? (
                  <Link
                    to="/head-office"
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-gray-900 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold ${
                      isActive ? "bg-white/15 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {item.shortLabel}
                  </span>
                  <span>{item.label}</span>
                  </Link>
                ) : (
                  <Link
                    to="/head-office/$section"
                    params={{ section: item.key }}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-gray-900 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold ${
                        isActive ? "bg-white/15 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.shortLabel}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-gray-100 p-4 text-xs text-gray-400">
        Shell foundation · compatibility mode
      </div>
    </>
  );
}

function HeadOfficePlaceholder({ section }: { section: HeadOfficeSection }) {
  const item = getHeadOfficeSection(section);

  if (section === "overview") {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Head Office Foundation</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">MyTree System Admin</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
            Application shell ใหม่สำหรับบริหารทั้งแพลตฟอร์ม โดยแยกออกจาก /sweet/admin เดิม
            เพื่อให้แต่ละ feature module สามารถพัฒนาและ migrate เข้ามาได้ทีละส่วนโดยไม่กระทบระบบเดิม
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["16", "Admin modules ready"],
            ["1", "Shared admin gate"],
            ["0", "Dead navigation"],
            ["Legacy", "Compatibility preserved"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-2xl font-bold">{value}</p>
              <p className="mt-1 text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6">
          <h3 className="font-semibold">Migration rule</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Business logic จาก AdminConsole เดิมยังคงอยู่ที่ /sweet/admin จนกว่า feature owner ของแต่ละ module
            จะ migrate เข้ามาและผ่าน test gate แล้ว
          </p>
          <Link
            to="/sweet/admin"
            className="mt-4 inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            เปิด Legacy Admin
          </Link>
        </section>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Route ready</p>
          <h2 className="mt-2 text-2xl font-bold">{item.label}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Shell, navigation, active state, breadcrumb และ responsive layout พร้อมแล้ว
            แต่ business module ของหน้านี้ยังไม่ได้ migrate ใน milestone แรก
          </p>
        </div>
        {["shops", "riders", "members", "moderation"].includes(section) && (
          <Link
            to="/sweet/admin"
            className="inline-flex shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ใช้งาน Legacy Admin ชั่วคราว
          </Link>
        )}
      </div>
      <div className="mt-8 rounded-2xl bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-800">Integration contract</p>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Feature owner สามารถแทนที่ placeholder ภายใน route นี้ได้โดยไม่ต้องสร้าง sidebar, header,
          auth guard หรือ mobile navigation ซ้ำ
        </p>
      </div>
    </section>
  );
}
