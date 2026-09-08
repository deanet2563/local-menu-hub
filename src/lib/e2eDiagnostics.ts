import liff from "@line/liff";
import { initLiff, LIFF_ID } from "@/lib/supabase";
import { MYTREE_WORKER_URL } from "@/lib/workerEndpoint";

export type LiffDiagnosticSnapshot = {
  liffId: string;
  isLoggedIn: boolean | null;
  isInClient: boolean | null;
  contextType: string | null;
  supabaseHost: string;
  supabaseRef: string;
  workerHost: string;
  userAgent: string;
  host: string;
  build: string;
  error: string | null;
};

export function e2eDiagnosticsEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_E2E_DIAGNOSTICS === "true";
}

export async function readLiffDiagnostics(): Promise<LiffDiagnosticSnapshot> {
  const supabaseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
  const workerUrl = new URL(MYTREE_WORKER_URL);
  const base = {
    liffId: LIFF_ID,
    supabaseHost: supabaseUrl.hostname,
    supabaseRef: supabaseUrl.hostname.split(".")[0] ?? "",
    workerHost: workerUrl.hostname,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    host: typeof window === "undefined" ? "" : window.location.hostname,
    build: import.meta.env.VITE_COMMIT_SHA || import.meta.env.VITE_BUILD_ID || "unknown",
  };
  try {
    await initLiff();
    const context = liff.getContext();
    const snapshot: LiffDiagnosticSnapshot = {
      ...base,
      isLoggedIn: liff.isLoggedIn(),
      isInClient: liff.isInClient(),
      contextType: context?.type ?? null,
      error: null,
    };
    console.info("[MyTree E2E LIFF diagnostics]", snapshot);
    return snapshot;
  } catch (cause) {
    const snapshot: LiffDiagnosticSnapshot = {
      ...base,
      isLoggedIn: null,
      isInClient: null,
      contextType: null,
      error: cause instanceof Error ? cause.message : "liff_diagnostics_failed",
    };
    console.info("[MyTree E2E LIFF diagnostics]", snapshot);
    return snapshot;
  }
}
