import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LineSessionRecoveryPanel } from "@/components/LineSessionRecoveryPanel";
import { isPreviewDebugAuthBypassActive } from "@/lib/previewDebugRoute";

type SimulationState = "required" | "recovering" | "failed";

export const Route = createFileRoute("/debug/line-session-recovery")({ component: LineSessionRecoveryDebugRoute });

function LineSessionRecoveryDebugRoute() {
  const [state, setState] = useState<SimulationState>("required");
  const [cartRetained, setCartRetained] = useState(true);
  const previewAuthBypassActive = isPreviewDebugAuthBypassActive();

  if (!previewAuthBypassActive) {
    return <main className="mx-auto max-w-md p-6 text-center"><h1 className="text-lg font-semibold text-gray-900">Not Found</h1></main>;
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
        <h1 className="text-base font-black tracking-normal text-amber-950">PREVIEW LINE SESSION TEST  NO REAL LOGIN / NO ORDER SUBMISSION</h1>
        <p className="mt-1 text-xs leading-5 text-amber-900">Simulated auth recovery only. This route never calls LINE Login, Supabase auth, quote, payment, or order APIs.</p>
        <p className="mt-2 font-mono text-xs text-amber-950">previewAuthBypass: active</p>
      </section>

      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-sm font-semibold text-gray-900">Session scenario</p>
        <div className="grid grid-cols-3 gap-2">
          {(["required", "recovering", "failed"] as const).map((nextState) => (
            <button key={nextState} type="button" onClick={() => setState(nextState)} className={`rounded-lg px-2 py-2 text-xs font-semibold ${state === nextState ? "bg-orange-500 text-white" : "border border-gray-200 bg-white text-gray-700"}`}>
              {nextState}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={cartRetained} onChange={(event) => setCartRetained(event.target.checked)} />
          Cart retained after cancelled/failed login
        </label>
      </section>

      <LineSessionRecoveryPanel
        state={state}
        message={cartRetained ? "Cart and checkout details remain saved." : "Simulation only: retention unchecked."}
        onLogin={() => setState("recovering")}
        onRetry={() => setState("required")}
      />
    </main>
  );
}
