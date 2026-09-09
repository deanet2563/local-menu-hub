import { MYTREE_WORKER_URL } from "@/lib/workerEndpoint";
import type { OrderPayload } from "@/lib/order";

export const INVALID_ORDER_PROBE_ID_TOKEN = "invalid-placeholder-line-id-token-order-network-probe";

export type OrderNetworkProbeId = "A" | "B" | "C" | "D" | "E";

export type OrderNetworkProbeResult = {
  probe: OrderNetworkProbeId;
  label: string;
  resolved: boolean;
  status: number | null;
  responseText: string;
  errorName: string | null;
  errorMessage: string | null;
  bodyBytes: number;
  startedAt: string;
  elapsedMs: number;
};

type ProbeBody = { idToken: string; order?: OrderPayload };

const WORKER_URL = MYTREE_WORKER_URL.replace(/\/+$/, "");

export function isOrderNetworkProbeVisible(): boolean {
  if (import.meta.env.VITE_ENABLE_E2E_DIAGNOSTICS !== "true") return false;
  if (typeof window === "undefined") return false;
  return window.location.hostname === "customer-staging.local-menu-hub.pages.dev";
}

export function buildMinimalOrderProbeBody(shopId: string | null | undefined): ProbeBody {
  return {
    idToken: INVALID_ORDER_PROBE_ID_TOKEN,
    order: {
      shopId: shopId || "00000000-0000-4000-8000-000000000000",
      fulfillment: "pickup",
      payment: "cash",
      address: null,
      destinationLat: null,
      destinationLng: null,
      note: null,
      items: [{
        lineId: "probe-line-1",
        kind: "item",
        itemId: "00000000-0000-4000-8000-000000000000",
        qty: 1,
        options: [],
        bundleSelections: [],
        note: null,
      }],
    },
  };
}

export function buildRedactedOrderProbeBody(order: OrderPayload): ProbeBody {
  return {
    idToken: INVALID_ORDER_PROBE_ID_TOKEN,
    order: {
      ...order,
      address: order.fulfillment === "delivery" ? "REDACTED_ADDRESS" : null,
      note: null,
      submittedMapUrl: order.submittedMapUrl ? "REDACTED_MAP_URL" : null,
      deliveryQuoteToken: order.deliveryQuoteToken ? "REDACTED_QUOTE_TOKEN" : null,
      items: order.items.map((item) => ({
        ...item,
        note: null,
      })),
    },
  };
}

export async function runOrderNetworkProbe(probe: OrderNetworkProbeId, body?: ProbeBody): Promise<OrderNetworkProbeResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const label = probeLabel(probe);
  const request = buildProbeRequest(probe, body);
  const bodyBytes = typeof request.init.body === "string" ? utf8ByteLength(request.init.body) : 0;

  try {
    const response = await fetch(request.url, request.init);
    const responseText = await response.text();
    return {
      probe,
      label,
      resolved: true,
      status: response.status,
      responseText: sanitizeProbeText(responseText),
      errorName: null,
      errorMessage: null,
      bodyBytes,
      startedAt,
      elapsedMs: Date.now() - started,
    };
  } catch (cause) {
    return {
      probe,
      label,
      resolved: false,
      status: null,
      responseText: "",
      errorName: cause instanceof Error ? cause.name : "UnknownError",
      errorMessage: cause instanceof Error ? cause.message : "network error",
      bodyBytes,
      startedAt,
      elapsedMs: Date.now() - started,
    };
  }
}

function buildProbeRequest(probe: OrderNetworkProbeId, body?: ProbeBody): { url: string; init: RequestInit } {
  if (probe === "A") {
    return { url: `${WORKER_URL}/health`, init: { method: "GET" } };
  }
  if (probe === "B") {
    return {
      url: `${WORKER_URL}/auth/line`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: INVALID_ORDER_PROBE_ID_TOKEN }),
      },
    };
  }
  return {
    url: `${WORKER_URL}/order`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? buildMinimalOrderProbeBody(null)),
    },
  };
}

function probeLabel(probe: OrderNetworkProbeId): string {
  switch (probe) {
    case "A": return "Health";
    case "B": return "Auth control";
    case "C": return "Minimal order";
    case "D": return "Real-shaped redacted order";
    case "E": return "Exact serialized real order body with invalid token";
  }
}

function sanitizeProbeText(value: string): string {
  return value
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted.jwt]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[redacted.uuid]")
    .slice(0, 500);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
