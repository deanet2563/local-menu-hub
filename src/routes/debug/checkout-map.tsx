import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DeliveryLocationPicker } from "@/components/DeliveryLocationPicker";
import type { ConfirmedDeliveryPoint } from "@/lib/deliveryLocation";
import { isCheckoutMapDebugRouteAllowedHost } from "@/lib/merchantMapMarkers";

type Search = {
  shopId?: string;
};

const PREVIEW_CUSTOMER_CANDIDATE: ConfirmedDeliveryPoint = {
  lat: 13.789336,
  lng: 100.686407,
  accuracy: null,
  source: "map_pin",
  submittedValue: null,
  resolvedUrl: null,
  placeId: null,
  displayName: "Real-device preview candidate",
  formattedAddress: "13.789336, 100.686407",
  resolutionMethod: null,
};

function isBlockedHost(): boolean {
  if (typeof window === "undefined") return true;
  return !isCheckoutMapDebugRouteAllowedHost(window.location.hostname);
}

export const Route = createFileRoute("/debug/checkout-map")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    shopId: typeof search.shopId === "string" && search.shopId.trim() ? search.shopId.trim() : undefined,
  }),
  component: CheckoutMapDebugRoute,
});

function CheckoutMapDebugRoute() {
  const { shopId } = Route.useSearch();
  const [candidate, setCandidate] = useState<ConfirmedDeliveryPoint | null>(null);

  if (isBlockedHost()) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Not Found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
        <h1 className="text-base font-black tracking-normal text-amber-950">PREVIEW MAP TEST  NO ORDER SUBMISSION</h1>
        <p className="mt-1 text-xs leading-5 text-amber-900">
          Uses the real checkout delivery map and public shop marker query. No cart, login, quote, or order submission runs here.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-sm font-semibold text-gray-900">Scenario</p>
        <p className="font-mono text-xs text-gray-600">shopId: {shopId ?? "missing"}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCandidate(null)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${candidate ? "border border-gray-200 bg-white text-gray-700" : "bg-orange-500 text-white"}`}
          >
            No candidate
          </button>
          <button
            type="button"
            onClick={() => setCandidate(PREVIEW_CUSTOMER_CANDIDATE)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${candidate ? "bg-orange-500 text-white" : "border border-gray-200 bg-white text-gray-700"}`}
          >
            Candidate 13.789336,100.686407
          </button>
        </div>
      </section>

      <DeliveryLocationPicker
        shopId={shopId ?? null}
        candidate={candidate}
        onCandidateChange={setCandidate}
        debug
      />
    </main>
  );
}
