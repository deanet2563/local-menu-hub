import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = await mkdtemp(path.join(tmpdir(), "order-network-probe-test-"));

try {
  const outfile = path.join(outdir, "orderNetworkProbe.mjs");
  const entryPath = path.join(repoRoot, "src/lib/orderNetworkProbe.ts");
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
      "import.meta.env.VITE_MYTREE_WORKER_URL": '"https://mytree-worker-staging.kompakorn-t.workers.dev"',
      "import.meta.env.VITE_ENABLE_E2E_DIAGNOSTICS": '"true"',
    },
    plugins: [{
      name: "probe-alias",
      setup(build) {
        build.onResolve({ filter: /^@\/lib\/workerEndpoint$/ }, () => ({ path: "workerEndpoint", namespace: "stub" }));
        build.onLoad({ filter: /^workerEndpoint$/, namespace: "stub" }, () => ({
          contents: "export const MYTREE_WORKER_URL = 'https://mytree-worker-staging.kompakorn-t.workers.dev';",
          loader: "js",
        }));
      },
    }],
  });

  const {
    INVALID_ORDER_PROBE_ID_TOKEN,
    isOrderNetworkProbeVisible,
    buildMinimalOrderProbeBody,
    buildRedactedOrderProbeBody,
    runOrderNetworkProbe,
  } = await import(pathToFileURL(outfile).href);

  globalThis.window = { location: { hostname: "customer-staging.local-menu-hub.pages.dev" } };
  assert.equal(isOrderNetworkProbeVisible(), true);
  globalThis.window = { location: { hostname: "customer.local-menu-hub.pages.dev" } };
  assert.equal(isOrderNetworkProbeVisible(), false);

  const order = {
    shopId: "shop-1",
    fulfillment: "pickup",
    payment: "cash",
    address: null,
    destinationLat: null,
    destinationLng: null,
    customerDeliveryCharge: 0,
    note: "private note",
    requestedFor: null,
    items: [{
      lineId: "line-1",
      kind: "item",
      itemId: "item-1",
      qty: 2,
      options: [{ groupId: "group-1", optionId: "option-1", name: "Hot", priceDelta: 0 }],
      bundleSelections: [],
      note: "line note",
      setId: "set-1",
      setName: "Set A",
    }],
  };

  const minimal = buildMinimalOrderProbeBody("shop-1");
  assert.equal(minimal.idToken, INVALID_ORDER_PROBE_ID_TOKEN);
  assert.equal(minimal.order.fulfillment, "pickup");
  assert.equal(minimal.order.items.length, 1);

  const redacted = buildRedactedOrderProbeBody(order);
  assert.equal(redacted.idToken, INVALID_ORDER_PROBE_ID_TOKEN);
  assert.equal(redacted.order.items.length, 1);
  assert.deepEqual(redacted.order.items[0].options, order.items[0].options);
  assert.equal(redacted.order.note, null);
  assert.equal(redacted.order.items[0].note, null);
  assert.equal(JSON.stringify(redacted).includes("private note"), false);

  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/health")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ error: "invalid LINE idToken" }), { status: 401 });
  };

  const result = await runOrderNetworkProbe("C", minimal);
  assert.equal(result.probe, "C");
  assert.equal(result.resolved, true);
  assert.equal(result.status, 401);
  assert.equal(result.bodyBytes > 0, true);
  assert.equal(result.responseText.includes("invalid LINE idToken"), true);
  assert.equal(calls[0].url, "https://mytree-worker-staging.kompakorn-t.workers.dev/order");
  assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/json" });
  assert.equal("Authorization" in calls[0].init.headers, false);
  assert.equal("X-MyTree-Debug-Request-ID" in calls[0].init.headers, false);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(JSON.parse(calls[0].init.body).idToken, INVALID_ORDER_PROBE_ID_TOKEN);
} finally {
  await rm(outdir, { recursive: true, force: true });
}
