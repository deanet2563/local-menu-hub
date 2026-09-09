import { createClient } from "@supabase/supabase-js";
import liff from "@line/liff";
import { isPreviewCheckoutMapAuthBypassActive } from "@/lib/previewDebugRoute";
import { safeStoragePath } from "@/lib/storageKey";
import { MYTREE_WORKER_URL } from "@/lib/workerEndpoint";
import { makeCustomerProfileTimelineEvent, type CustomerProfileTimelineEvent, type CustomerProfileTimelineStep } from "@/lib/customerProfileDiagnostics";

// ============================================================
// MyTree — Supabase clients
//
// publicSupabase: anonymous/public catalog reads only. This must never trigger
// LINE login, so menu/options/bundles can render in preview/external browsers.
//
// supabase: authenticated client for customer/profile/shop-management flows.
// Flow: LIFF login -> getIDToken -> POST /auth/line -> Supabase JWT.
// ============================================================

const DEFAULT_LIFF_ID = "2010936243-3kPykppE";
export const LIFF_ID = import.meta.env.VITE_LIFF_ID || DEFAULT_LIFF_ID;
const AUTH_BROKER = `${MYTREE_WORKER_URL}/auth/line`;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let liffReady: Promise<void> | null = null;
let cached: { token: string; exp: number } | null = null;

type CustomerProfileTraceOptions = {
  onTimelineStep?: (event: CustomerProfileTimelineEvent) => void;
};

function customerProfileTraceEmitter(options?: CustomerProfileTraceOptions) {
  const startedAt = Date.now();
  return (step: CustomerProfileTimelineStep, detail?: string) => {
    options?.onTimelineStep?.(makeCustomerProfileTimelineEvent(step, startedAt, undefined, detail));
  };
}

/** True for isolated non-production Customer previews. */
export function isOrderingPreview(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return hostname === "mytree-ordering-flow-v2.local-menu-hub.pages.dev"
    || hostname === "customer-staging.local-menu-hub.pages.dev"
    || hostname === "customer-e2e.local-menu-hub.pages.dev"
    || /^customer-e2e-[a-z0-9-]+\.local-menu-hub\.pages\.dev$/i.test(hostname);
}

/** Anonymous client for public catalog/configuration reads. Never invokes LIFF. */
export const publicSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Initialise the environment-selected LIFF app exactly once. */
export function initLiff(): Promise<void> {
  if (isPreviewCheckoutMapAuthBypassActive()) return Promise.resolve();
  if (!liffReady) {
    liffReady = liff.init({
      liffId: LIFF_ID,
      // Do not auto-login when somebody opens the raw Pages URL in Safari.
      // When launched through the LIFF URL inside LINE, LIFF handles the
      // in-client session automatically.
      withLoginOnExternalBrowser: false,
    });
  }
  return liffReady;
}

/** Get a valid MyTree access token, logging in via LINE if needed. */
export async function getAccessToken(options?: CustomerProfileTraceOptions): Promise<string> {
  const emit = customerProfileTraceEmitter(options);
  if (isPreviewCheckoutMapAuthBypassActive()) return "";
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  emit("liff_ready_wait_started");
  await initLiff();
  emit("liff_ready_wait_resolved");
  const loggedIn = liff.isLoggedIn();
  emit("liff_is_logged_in", loggedIn ? "yes" : "no");
  try {
    const context = liff.getContext();
    emit("liff_context_read", context?.type ?? "null");
  } catch (cause) {
    emit("liff_context_read", cause instanceof Error ? cause.message : "error");
  }
  if (!loggedIn) {
    // Raw preview browsing intentionally works outside LINE. Authenticated
    // actions are allowed only after the same preview is launched through its
    // configured staging LIFF URL.
    if (isOrderingPreview()) return "";
    liff.login();
    return "";
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    if (isOrderingPreview()) return "";
    throw new Error("no LINE idToken");
  }

  emit("customer_identity_read_started");
  const brokerUrl = new URL(AUTH_BROKER);
  const debugRequestId = makeDebugRequestId();
  emit("auth_broker_request_started", `POST ${brokerUrl.origin}${brokerUrl.pathname} request_id=${debugRequestId}`);
  emit("auth_fetch_started", `${brokerUrl.origin}${brokerUrl.pathname}`);
  let res: Response;
  try {
    res = await fetch(AUTH_BROKER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MyTree-Debug-Request-ID": debugRequestId,
      },
      body: JSON.stringify({ idToken }),
    });
  } catch (cause) {
    emit("auth_fetch_rejected", cause instanceof Error ? `${cause.name}: ${cause.message}` : "fetch rejected");
    throw cause;
  }
  emit("auth_fetch_resolved", debugRequestId);
  emit("auth_broker_response_status", String(res.status));
  emit("auth_broker_response_environment", res.headers.get("X-MyTree-Environment") ?? "missing");
  emit("auth_broker_response_worker_sha", res.headers.get("X-MyTree-Worker-SHA") ?? "missing");
  emit("auth_broker_response_debug_id", res.headers.get("X-MyTree-Debug-Request-ID") ?? "missing");
  emit("customer_identity_read_resolved", String(res.status));
  if (!res.ok) {
    const safeBody = sanitizeBrokerErrorBody(await res.text());
    if (safeBody) emit("auth_broker_response_body", safeBody);
    throw new Error(`auth broker error: ${res.status}${safeBody ? ` ${safeBody}` : ""}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };

  cached = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

/** The current MyTree customer_id (from the LINE-issued token), or null. */
export async function getCurrentCustomerId(options?: CustomerProfileTraceOptions): Promise<string | null> {
  const emit = customerProfileTraceEmitter(options);
  emit("customer_profile_function_entered");
  const token = await getAccessToken(options);
  if (!token) {
    emit("customer_profile_missing", "no_token");
    emit("customer_profile_function_returned");
    return null;
  }
  try {
    emit("customer_identity_read_started", "jwt_payload");
    const part = token.split(".")[1];
    if (!part) {
      emit("customer_identity_read_resolved", "missing_payload");
      emit("customer_profile_missing", "missing_payload");
      emit("customer_profile_function_returned");
      return null;
    }
    const payload = JSON.parse(atob(part));
    emit("customer_identity_read_resolved", "jwt_payload");
    if (!payload.customer_id) {
      emit("customer_profile_missing", "missing_customer_id");
      emit("customer_profile_function_returned");
      return null;
    }
    emit("customer_profile_found");
    emit("customer_profile_function_returned");
    return payload.customer_id ?? null;
  } catch {
    emit("customer_profile_error");
    emit("customer_profile_function_returned");
    return null;
  }
}

const authenticatedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => (await getAccessToken()) || null,
});

// Supabase Storage follows AWS object-key naming rules. Shop IDs are user-facing
// text and may contain Thai characters, so storage paths must be converted to a
// stable ASCII-safe representation before they reach Storage. Database shop_id
// values are intentionally left untouched.
const rawStorageFrom = authenticatedSupabase.storage.from.bind(authenticatedSupabase.storage);
authenticatedSupabase.storage.from = ((bucketId: string) => {
  const bucket = rawStorageFrom(bucketId);
  return new Proxy(bucket, {
    get(target, prop, receiver) {
      if (prop === "upload") {
        return (path: string, fileBody: Parameters<typeof target.upload>[1], fileOptions?: Parameters<typeof target.upload>[2]) =>
          target.upload(safeStoragePath(path), fileBody, fileOptions);
      }
      if (prop === "getPublicUrl") {
        return (path: string, options?: Parameters<typeof target.getPublicUrl>[1]) =>
          target.getPublicUrl(safeStoragePath(path), options);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}) as typeof authenticatedSupabase.storage.from;

export const supabase = authenticatedSupabase;

export function sanitizeBrokerErrorBody(value: string): string {
  return value
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}/gi, "[uuid]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .slice(0, 240);
}

function makeDebugRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}
