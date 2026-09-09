import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = await mkdtemp(path.join(tmpdir(), "gate-a-account-profile-test-"));

try {
  const supabaseOut = path.join(outdir, "supabase.mjs");
  const liffCalls = [];
  const fetchCalls = [];

  const commonPlugins = [{
    name: "gate-a-stubs",
    setup(build) {
      build.onResolve({ filter: /^@line\/liff$/ }, () => ({ path: "liff", namespace: "stub" }));
      build.onLoad({ filter: /^liff$/, namespace: "stub" }, () => ({
        contents: `
          export default {
            init: async (options) => globalThis.__liffCalls.push(["init", options]),
            isLoggedIn: () => true,
            isInClient: () => true,
            getIDToken: () => "line-id-token",
            getContext: () => ({ type: "utou" }),
            login: () => globalThis.__liffCalls.push(["login"]),
          };
        `,
        loader: "js",
      }));
      build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: "supabase-js", namespace: "stub" }));
      build.onLoad({ filter: /^supabase-js$/, namespace: "stub" }, () => ({
        contents: `
          export function createClient(url, key, options) {
            globalThis.__supabaseClients.push({ url, key, options });
            return { storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({}) }) } };
          }
        `,
        loader: "js",
      }));
      build.onResolve({ filter: /^@\/lib\/previewDebugRoute$/ }, () => ({ path: "previewDebugRoute", namespace: "stub" }));
      build.onLoad({ filter: /^previewDebugRoute$/, namespace: "stub" }, () => ({
        contents: "export const isPreviewCheckoutMapAuthBypassActive = () => false;",
        loader: "js",
      }));
      build.onResolve({ filter: /^@\/lib\/storageKey$/ }, () => ({ path: "storageKey", namespace: "stub" }));
      build.onLoad({ filter: /^storageKey$/, namespace: "stub" }, () => ({
        contents: "export const safeStoragePath = (value) => value;",
        loader: "js",
      }));
      build.onResolve({ filter: /^@\/lib\/customerProfileDiagnostics$/ }, () => ({ path: "customerProfileDiagnostics", namespace: "stub" }));
      build.onLoad({ filter: /^customerProfileDiagnostics$/, namespace: "stub" }, () => ({
        contents: "export const makeCustomerProfileTimelineEvent = (step, startedAt, _id, detail) => ({ step, at: new Date().toISOString(), elapsedMs: Date.now() - startedAt, detail });",
        loader: "js",
      }));
      build.onResolve({ filter: /^@\/lib\/mytreeSession$/ }, () => ({ path: "mytreeSession", namespace: "stub" }));
      build.onLoad({ filter: /^mytreeSession$/, namespace: "stub" }, () => ({
        contents: "export const browserSessionStorage = () => null; export const loadMyTreeSession = () => null; export const saveMyTreeSession = () => {};",
        loader: "js",
      }));
      build.onResolve({ filter: /^@\/lib\/workerEndpoint$/ }, () => ({
        path: path.join(repoRoot, "src/lib/workerEndpoint.ts"),
      }));
    },
  }];

  await esbuild.build({
    entryPoints: [path.join(repoRoot, "src/lib/supabase.ts")],
    outfile: supabaseOut,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    define: {
      "import.meta.env.VITE_LIFF_ID": '"production-liff-id"',
      "import.meta.env.VITE_SUPABASE_URL": '"https://production-ref.supabase.co"',
      "import.meta.env.VITE_SUPABASE_ANON_KEY": '"staging-anon-key"',
      "import.meta.env.VITE_MYTREE_WORKER_URL": '"https://mytree-worker.kompakorn-t.workers.dev"',
    },
    plugins: commonPlugins,
  });

  globalThis.__liffCalls = liffCalls;
  globalThis.__supabaseClients = [];
  globalThis.window = {
    location: {
      hostname: "customer-staging.local-menu-hub.pages.dev",
      pathname: "/account",
      href: "https://customer-staging.local-menu-hub.pages.dev/account",
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "Line/15.0" },
  });
  globalThis.atob = (value) => Buffer.from(value, "base64url").toString("utf8");
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    const payload = Buffer.from(JSON.stringify({ customer_id: "customer-1" })).toString("base64url");
    return Response.json({ access_token: `header.${payload}.sig`, expires_in: 3600 });
  };

  const { LIFF_ID, MYTREE_SUPABASE_URL, getCurrentCustomerId, isOrderingPreview } = await import(pathToFileURL(supabaseOut).href);
  assert.equal(LIFF_ID, "2010936243-hG7sC3Wd");
  assert.equal(MYTREE_SUPABASE_URL, "https://qdvgkdxjstsxeamjsjhl.supabase.co");
  assert.equal(isOrderingPreview(), false);
  assert.equal(await getCurrentCustomerId(), "customer-1");
  assert.deepEqual(liffCalls[0], ["init", { liffId: "2010936243-hG7sC3Wd", withLoginOnExternalBrowser: false }]);
  assert.equal(fetchCalls[0].url, "https://mytree-worker-staging.kompakorn-t.workers.dev/auth/line");
  assert.equal(fetchCalls[0].init.headers["Content-Type"], "application/json");
  assert.equal(globalThis.__supabaseClients[0].url, "https://qdvgkdxjstsxeamjsjhl.supabase.co");
} finally {
  await rm(outdir, { recursive: true, force: true });
}
