export type StagingDiagnosticSnapshot = {
  liffId: string;
  isInClient: boolean | null;
  isLoggedIn: boolean | null;
  supabaseRef: string;
  supabaseHost: string;
  workerHost: string;
  buildSha: string;
  myTreeSessionReady: boolean | null;
};

export function isStagingDiagnosticsHost(hostname: string): boolean {
  return hostname === "customer-staging.local-menu-hub.pages.dev"
    || hostname === "customer-e2e.local-menu-hub.pages.dev"
    || /^customer-e2e-[a-z0-9-]+\.local-menu-hub\.pages\.dev$/i.test(hostname);
}

export function buildStagingDiagnosticSnapshot(input: {
  hostname: string;
  liffId: string;
  supabaseUrl: string;
  workerUrl: string;
  isInClient?: boolean | null;
  isLoggedIn?: boolean | null;
  buildSha?: string;
  myTreeSessionReady?: boolean | null;
}): StagingDiagnosticSnapshot | null {
  if (!isStagingDiagnosticsHost(input.hostname)) return null;
  const supabaseUrl = new URL(input.supabaseUrl);
  const workerUrl = new URL(input.workerUrl);
  return {
    liffId: input.liffId,
    isInClient: input.isInClient ?? null,
    isLoggedIn: input.isLoggedIn ?? null,
    supabaseRef: supabaseUrl.hostname.split(".")[0] ?? "",
    supabaseHost: supabaseUrl.hostname,
    workerHost: workerUrl.hostname,
    buildSha: input.buildSha ?? "unknown",
    myTreeSessionReady: input.myTreeSessionReady ?? null,
  };
}
