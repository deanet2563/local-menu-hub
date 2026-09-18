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
    <main className="min-h-screen bg-cream px-4 py-8 font-community text-ink">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="mx-auto max-w-3xl rounded-lg border border-[#e7e4dc] bg-white p-5 text-center text-sm font-medium text-ink-soft"
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
