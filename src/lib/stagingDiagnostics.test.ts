import {
  buildStagingDiagnosticSnapshot,
  isStagingDiagnosticsHost,
} from "@/lib/stagingDiagnostics";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const staging = buildStagingDiagnosticSnapshot({
  hostname: "customer-staging.local-menu-hub.pages.dev",
  liffId: "2010936243-hG7sC3Wd",
  supabaseUrl: "https://qdvgkdxjstsxeamjsjhl.supabase.co",
  workerUrl: "https://mytree-worker-staging.kompakorn-t.workers.dev",
  buildSha: "test-sha",
  myTreeSessionReady: true,
});

assertEqual(isStagingDiagnosticsHost("customer-staging.local-menu-hub.pages.dev"), true, "customer staging host shows diagnostics");
assertEqual(isStagingDiagnosticsHost("customer-e2e.local-menu-hub.pages.dev"), true, "customer e2e host shows diagnostics");
assertEqual(isStagingDiagnosticsHost("local-menu-hub.pages.dev"), false, "production Pages host hides diagnostics");
assertEqual(isStagingDiagnosticsHost("mytree.cc"), false, "production domain hides diagnostics");
assertEqual(staging?.liffId, "2010936243-hG7sC3Wd", "diagnostics expose staging LIFF ID");
assertEqual(staging?.supabaseRef, "qdvgkdxjstsxeamjsjhl", "diagnostics expose staging Supabase ref");
assertEqual(staging?.supabaseHost, "qdvgkdxjstsxeamjsjhl.supabase.co", "diagnostics expose staging Supabase host");
assertEqual(staging?.workerHost, "mytree-worker-staging.kompakorn-t.workers.dev", "diagnostics expose staging Worker host");
assertEqual(staging?.buildSha, "test-sha", "diagnostics expose staging build SHA");
assertEqual(staging?.myTreeSessionReady, true, "diagnostics expose MyTree session readiness");
assertEqual("tokenPresent" in (staging ?? {}), false, "diagnostics do not expose token state");
assertEqual("anonKeyPresent" in (staging ?? {}), false, "diagnostics do not expose key state");
