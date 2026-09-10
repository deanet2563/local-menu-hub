import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = await mkdtemp(path.join(tmpdir(), "order-fetch-runtime-test-"));

const aliasPlugin = {
  name: "order-fetch-runtime-alias",
  setup(build) {
    const empty = "empty";
    build.onResolve({ filter: /^@line\/liff$/ }, () => ({ path: "liff", namespace: empty }));
    build.onLoad({ filter: /^liff$/, namespace: empty }, () => ({
      contents: "export default { isLoggedIn: () => true, isInClient: () => true, getIDToken: () => 'line-id-token', login: () => {} };",
      loader: "js",
    }));
    build.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "supabase", namespace: empty }));
    build.onLoad({ filter: /^supabase$/, namespace: empty }, () => ({
      contents: "export const initLiff = async () => {}; export const isOrderingPreview = () => false;",
      loader: "js",
    }));
    build.onResolve({ filter: /^@\/lib\/cart$/ }, () => ({ path: "cart", namespace: empty }));
    build.onLoad({ filter: /^cart$/, namespace: empty }, () => ({
      contents: "export const cart = { getState: () => ({ items: [] }) };",
      loader: "js",
    }));
    build.onResolve({ filter: /^@\/lib\/deliveryLocation$/ }, () => ({ path: "deliveryLocation", namespace: empty }));
    build.onLoad({ filter: /^deliveryLocation$/, namespace: empty }, () => ({
      contents: "export const getDeliveryQuoteToken = () => null;",
      loader: "js",
    }));
    build.onResolve({ filter: /^@\/lib\/workerEndpoint$/ }, () => ({ path: "workerEndpoint", namespace: empty }));
    build.onLoad({ filter: /^workerEndpoint$/, namespace: empty }, () => ({
      contents: "export const MYTREE_WORKER_URL = 'https://mytree-worker-staging.kompakorn-t.workers.dev';",
      loader: "js",
    }));
    build.onResolve({ filter: /^@\/lib\/orderNetworkProbe$/ }, () => ({ path: "orderNetworkProbe", namespace: empty }));
    build.onLoad({ filter: /^orderNetworkProbe$/, namespace: empty }, () => ({
      contents: "export const INVALID_ORDER_PROBE_ID_TOKEN = 'invalid-placeholder-line-id-token-order-network-probe';",
      loader: "js",
    }));
  },
};

try {
  const outfile = path.join(outdir, "order.mjs");
  const entryPath = path.join(repoRoot, "src/lib/order.ts");
  await esbuild.build({
    stdin: {
      contents: await readFile(entryPath, "utf8"),
      sourcefile: entryPath,
      resolveDir: path.dirname(entryPath),
      loader: "ts",
    },
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    define: {
      "import.meta.env.VITE_ENABLE_E2E_DIAGNOSTICS": '"true"',
    },
    plugins: [aliasPlugin],
  });

  globalThis.window = {
    location: { origin: "https://customer-staging.local-menu-hub.pages.dev" },
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });

  const { submitOrder } = await import(pathToFileURL(outfile).href);
  const timeline = [];
  const payload = {
    shopId: "10000000-0000-4000-8000-000000000001",
    fulfillment: "pickup",
    payment: "cash",
    address: null,
    destinationLat: null,
    destinationLng: null,
    note: null,
    items: [{
      lineId: "line-1",
      kind: "item",
      itemId: "20000000-0000-4000-8000-000000000001",
      qty: 1,
      options: [],
      bundleSelections: [],
      note: null,
    }],
  };

  let capturedInit;
  globalThis.fetch = async (_url, init) => {
    capturedInit = init;
    return Response.json({ ok: true, order_id: "order-1", sub_id: "sub-1" });
  };
  const result = await submitOrder(payload, { onTimelineStep: (event) => timeline.push(event) });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.workerReached, true);
  assert.equal(result.diagnostics.status, 200);
  assert.equal(capturedInit.method, "POST");
  assert.deepEqual(capturedInit.headers, { "Content-Type": "application/json" });
  assert.equal("Authorization" in capturedInit.headers, false);
  assert.equal("X-MyTree-Debug-Request-ID" in capturedInit.headers, false);
  assert.equal("signal" in capturedInit, false);

  const prefetch = timeline.find((event) => event.step === "prefetch_diagnostics");
  assert.match(prefetch?.detail ?? "", /url=https:\/\/mytree-worker-staging\.kompakorn-t\.workers\.dev\/order/);
  assert.match(prefetch?.detail ?? "", /method=POST/);
  assert.match(prefetch?.detail ?? "", /hasAuthorizationHeader=no/);
  assert.match(prefetch?.detail ?? "", /hasIdTokenBody=yes/);
  assert.match(prefetch?.detail ?? "", /body_serialization_completed=yes/);
  assert.match(prefetch?.detail ?? "", /body_byte_length=\d+/);
  assert.doesNotMatch(prefetch?.detail ?? "", /line-id-token/);
  const workerHeaders = timeline.find((event) => event.step === "worker_response_headers");
  assert.match(workerHeaders?.detail ?? "", /worker_reached=yes/);

  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  const rejectedTimeline = [];
  const rejected = await submitOrder(payload, { onTimelineStep: (event) => rejectedTimeline.push(event) });
  assert.equal(rejected.ok, false);
  const rejectedEvent = rejectedTimeline.find((event) => event.step === "fetch_rejected");
  assert.match(rejectedEvent?.detail ?? "", /name=TypeError/);
  assert.match(rejectedEvent?.detail ?? "", /message=Failed to fetch/);
  assert.match(rejectedEvent?.detail ?? "", /abort_controller=unused/);
  assert.match(rejectedEvent?.detail ?? "", /timeout_triggered=no/);
  assert.match(rejectedEvent?.detail ?? "", /navigator_onLine=yes/);
  assert.match(rejectedEvent?.detail ?? "", /origin=https:\/\/customer-staging\.local-menu-hub\.pages\.dev/);
} finally {
  await rm(outdir, { recursive: true, force: true });
}
