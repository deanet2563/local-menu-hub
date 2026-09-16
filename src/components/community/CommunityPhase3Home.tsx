import {
  COMMUNITY_PHASE3_PILOT,
  COMMUNITY_PHASE3_SECTIONS,
  buildCommunityNavigationItems,
} from "@/lib/communityPhase3";

export function CommunityPhase3Home() {
  const navItems = buildCommunityNavigationItems(COMMUNITY_PHASE3_PILOT.slug);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Community Phase 3 Foundation
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">{COMMUNITY_PHASE3_PILOT.name}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Sammakorn-first scaffold for member-scoped community surfaces. This page is a static
              route placeholder and does not read or write community database records yet.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <BoundaryFact label="Pilot" value={COMMUNITY_PHASE3_PILOT.pilotMode} />
            <BoundaryFact label="Boundary" value={COMMUNITY_PHASE3_PILOT.boundaryLabel} />
            <BoundaryFact label="Default visibility" value={COMMUNITY_PHASE3_PILOT.defaultVisibility} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              aria-disabled={!item.isEnabled}
              className="block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              {item.label}
              {!item.isEnabled && <span className="ml-2 text-xs font-normal text-slate-400">planned</span>}
            </a>
          ))}
        </nav>

        <div className="grid gap-3 sm:grid-cols-2">
          {COMMUNITY_PHASE3_SECTIONS.map((section) => (
            <article key={section.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{section.label}</h2>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                  {section.visibility}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
              <p className="mt-3 text-xs font-medium text-slate-500">
                {section.requiresDatabase ? "DB contract required next" : "Route scaffold ready"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function BoundaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
