import { lazy, Suspense } from "react";
import type { CommunityPrototypeDetailKind, CommunityPrototypeSurface } from "@/lib/communityPrototype";

const CommunityPrototype = lazy(() => import("@/components/community/CommunityPrototype").then((module) => ({
  default: module.CommunityPrototype,
})));

const CommunityDetail = lazy(() => import("@/components/community/CommunityDetail").then((module) => ({
  default: module.CommunityDetail,
})));

function CommunityRouteLoading() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-8 text-slate-950">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5 text-center text-sm font-medium text-slate-700"
      >
        กำลังเปิด Community...
      </div>
    </main>
  );
}

export function CommunitySurfaceRoute({ surface }: { surface: CommunityPrototypeSurface }) {
  return (
    <Suspense fallback={<CommunityRouteLoading />}>
      <CommunityPrototype surface={surface} />
    </Suspense>
  );
}

export function CommunityDetailRoute({ kind, itemId }: { kind: CommunityPrototypeDetailKind; itemId: string }) {
  return (
    <Suspense fallback={<CommunityRouteLoading />}>
      <CommunityDetail kind={kind} itemId={itemId} />
    </Suspense>
  );
}
