import { createClient } from "@supabase/supabase-js";
import liff from "@line/liff";
import { isPreviewCheckoutMapAuthBypassActive } from "@/lib/previewDebugRoute";
import { safeStoragePath } from "@/lib/storageKey";
import { MYTREE_WORKER_URL } from "@/lib/workerEndpoint";
import { makeCustomerProfileTimelineEvent, type CustomerProfileTimelineEvent, type CustomerProfileTimelineStep } from "@/lib/customerProfileDiagnostics";
import { browserSessionStorage, loadMyTreeSession, saveMyTreeSession } from "@/lib/mytreeSession";

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
const STAGING_HOST = "customer-staging.local-menu-hub.pages.dev";
const STAGING_LIFF_ID = "2010936243-hG7sC3Wd";
const STAGING_WORKER_URL = "https://mytree-worker-staging.kompakorn-t.workers.dev";
const STAGING_SUPABASE_URL = "https://qdvgkdxjstsxeamjsjhl.supabase.co";
const STAGING_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdmdrZHhqc3RzeGVhbWpzamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NDA0NDcsImV4cCI6MjEwNDQxNjQ0N30.bEekjhWLhoI_aISu73uAW3MAMYKtPGajRp0grovOM6M";

function isCustomerStagingHost(): boolean {
  return typeof window !== "undefined" && window.location.hostname === STAGING_HOST;
}

export const LIFF_ID = isCustomerStagingHost()
  ? STAGING_LIFF_ID
  : import.meta.env.VITE_LIFF_ID || DEFAULT_LIFF_ID;
const AUTH_BROKER = `${isCustomerStagingHost() ? STAGING_WORKER_URL : MYTREE_WORKER_URL}/auth/line`;
export const MYTREE_SUPABASE_URL = isCustomerStagingHost()
  ? STAGING_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = isCustomerStagingHost()
  ? STAGING_SUPABASE_ANON_KEY
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

let liffReady: Promise<void> | null = null;
let cached: { token: string; exp: number } | null = null;

type CustomerProfileTraceOptions = {
  onTimelineStep?: (event: CustomerProfileTimelineEvent) => void;
};

export type MyTreeAuthState =
  | { status: "ready"; accessToken: string; customerId: string; accessExp: number; refreshToken?: string; refreshExp?: number }
  | { status: "external_browser" | "line_not_logged_in" | "missing_id_token" | "missing_customer_id"; accessToken?: undefined; customerId?: undefined };

export function shouldStartLiffLogin(input: { isInClient: boolean; isLoggedIn: boolean }): boolean {
  return input.isInClient && !input.isLoggedIn;
}

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
    || hostname === "customer-e2e.local-menu-hub.pages.dev"
    || /^customer-e2e-[a-z0-9-]+\.local-menu-hub\.pages\.dev$/i.test(hostname);
}

/** Anonymous client for public catalog/configuration reads. Never invokes LIFF. */
export const publicSupabase = createClient(MYTREE_SUPABASE_URL, SUPABASE_ANON_KEY, {
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
export async function ensureMyTreeSession(options?: CustomerProfileTraceOptions): Promise<MyTreeAuthState> {
  const emit = customerProfileTraceEmitter(options);
  emit("auth_bootstrap_started");
  if (isPreviewCheckoutMapAuthBypassActive()) {
    emit("auth_bootstrap_returned", "external_browser");
    return { status: "external_browser" };
  }
  const now = Math.floor(Date.now() / 1000);
  emit("liff_ready_wait_started");
  await initLiff();
  emit("liff_ready_wait_resolved");
  const inClient = liff.isInClient();
  emit("liff_in_client", inClient ? "yes" : "no");
  if (!inClient) {
    emit("auth_bootstrap_returned", "external_browser");
    return { status: "external_browser" };
  }
  const loggedIn = liff.isLoggedIn();
  emit("liff_is_logged_in", loggedIn ? "yes" : "no");
  try {
    const context = liff.getContext();
    emit("liff_context_read", context?.type ?? "null");
  } catch (cause) {
    emit("liff_context_read", cause instanceof Error ? cause.message : "error");
  }
  if (shouldStartLiffLogin({ isInClient: inClient, isLoggedIn: loggedIn })) {
    liff.login();
    emit("auth_bootstrap_returned", "line_not_logged_in");
    return { status: "line_not_logged_in" };
  }

  if (cached && cached.exp - 60 > now) {
    const customerId = customerIdFromToken(cached.token);
    if (customerId) {
      emit("mytree_access_token_stored", "yes");
      emit("authenticated_supabase_client_ready", "yes");
      emit("customer_id_resolved", "yes");
      emit("auth_bootstrap_returned", "ready");
      return { status: "ready", accessToken: cached.token, accessExp: cached.exp, customerId };
    }
  }
  const stored = loadMyTreeSession(browserSessionStorage(), now);
  if (stored) {
    const customerId = customerIdFromToken(stored.accessToken);
    if (!customerId) {
      emit("customer_profile_missing", "missing_customer_id");
      emit("auth_bootstrap_returned", "missing_customer_id");
      return { status: "missing_customer_id" };
    }
    cached = { token: stored.accessToken, exp: stored.accessExp };
    emit("mytree_access_token_stored", "yes");
    emit("refresh_session_credential_stored", stored.refreshToken ? "yes" : "no");
    emit("authenticated_supabase_client_ready", "yes");
    emit("customer_id_resolved", "yes");
    emit("auth_bootstrap_returned", "ready");
    return {
      status: "ready",
      accessToken: stored.accessToken,
      accessExp: stored.accessExp,
      refreshToken: stored.refreshToken,
      refreshExp: stored.refreshExp,
      customerId,
    };
  }
  emit("mytree_access_token_stored", "no");
  emit("refresh_session_credential_stored", "no");

  const idToken = liff.getIDToken();
  emit("id_token_available", idToken ? "yes" : "no");
  if (!idToken) {
    if (isOrderingPreview()) {
      emit("auth_bootstrap_returned", "missing_id_token");
      return { status: "missing_id_token" };
    }
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
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_expires_in?: number;
  };
  emit("app_session_response_received", data.access_token ? "yes" : "no");

  cached = { token: data.access_token, exp: now + data.expires_in };
  saveMyTreeSession(browserSessionStorage(), {
    accessToken: data.access_token,
    accessExp: cached.exp,
    refreshToken: data.refresh_token,
    refreshExp: data.refresh_expires_in ? now + data.refresh_expires_in : undefined,
  });
  emit("mytree_access_token_stored", data.access_token ? "yes" : "no");
  emit("refresh_session_credential_stored", data.refresh_token ? "yes" : "no");
  emit("authenticated_supabase_client_ready", data.access_token ? "yes" : "no");
  const customerId = customerIdFromToken(data.access_token);
  if (!customerId) {
    emit("customer_profile_missing", "missing_customer_id");
    emit("auth_bootstrap_returned", "missing_customer_id");
    return { status: "missing_customer_id" };
  }
  emit("customer_id_resolved", "yes");
  emit("auth_bootstrap_returned", "ready");
  return {
    status: "ready",
    accessToken: data.access_token,
    accessExp: cached.exp,
    refreshToken: data.refresh_token,
    refreshExp: data.refresh_expires_in ? now + data.refresh_expires_in : undefined,
    customerId,
  };
}

export async function getAccessToken(options?: CustomerProfileTraceOptions): Promise<string> {
  const session = await ensureMyTreeSession(options);
  return session.status === "ready" ? session.accessToken : "";
}

/** The current MyTree customer_id (from the LINE-issued token), or null. */
export async function getCurrentCustomerId(options?: CustomerProfileTraceOptions): Promise<string | null> {
  const emit = customerProfileTraceEmitter(options);
  emit("customer_profile_function_entered");
  const session = await ensureMyTreeSession(options);
  if (session.status !== "ready") {
    emit("customer_profile_missing", "no_token");
    emit("customer_profile_function_returned");
    return null;
  }
  emit("customer_profile_found");
  emit("customer_profile_function_returned");
  return session.customerId;
}

const authenticatedSupabase = createClient(MYTREE_SUPABASE_URL, SUPABASE_ANON_KEY, {
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

function customerIdFromToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part)) as { customer_id?: unknown };
    return typeof payload.customer_id === "string" && payload.customer_id ? payload.customer_id : null;
  } catch {
    return null;
  }
}
