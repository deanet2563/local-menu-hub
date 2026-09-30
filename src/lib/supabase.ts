import { createClient } from "@supabase/supabase-js";
import liff from "@line/liff";
import { isPreviewCheckoutMapAuthBypassActive } from "@/lib/previewDebugRoute";
import { safeStoragePath } from "@/lib/storageKey";

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
const DEFAULT_SHOP_LIFF_ID = import.meta.env.VITE_SHOP_LIFF_ID || DEFAULT_LIFF_ID;
const STAGING_SHOP_LIFF_ID = import.meta.env.VITE_STAGING_SHOP_LIFF_ID || "2010936243-c381Q2kY";
const STAGING_SUPABASE_URL = "https://qdvgkdxjstsxeamjsjhl.supabase.co";
const STAGING_SUPABASE_ANON_KEY = "sb_publishable_2c9IeRf-5IBL74pPIUi3_Q_vI9w9gG0";
const STAGING_AUTH_BROKER = "https://mytree-worker-staging.kompakorn-t.workers.dev/auth/line";

function isCloudflarePreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname.endsWith(".local-menu-hub.pages.dev")
    && hostname !== "local-menu-hub.pages.dev";
}

export const LIFF_ID = import.meta.env.VITE_LIFF_ID || DEFAULT_LIFF_ID;
const AUTH_BROKER = isCloudflarePreviewHost()
  ? STAGING_AUTH_BROKER
  : "https://mytree-worker.kompakorn-t.workers.dev/auth/line";
export const SUPABASE_URL = isCloudflarePreviewHost()
  ? STAGING_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = isCloudflarePreviewHost()
  ? STAGING_SUPABASE_ANON_KEY
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

let liffReady: { liffId: string; promise: Promise<void> } | null = null;
let cached: { token: string; exp: number } | null = null;

const LIFF_INIT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

const PREVIEW_SUFFIX = ".local-menu-hub.pages.dev";
const NON_PREVIEW_HOSTS = new Set(["mytree.cc", "www.mytree.cc", "local-menu-hub.pages.dev"]);

/** True only for Cloudflare Pages branch/hash previews or an explicit preview build flag.
 * Production custom domains and the canonical Pages production host are always excluded. */
export function isOrderingPreview(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_ALLOW_ANONYMOUS_PREVIEW === "true") return true;

  const hostname = window.location.hostname.toLowerCase();
  return hostname.endsWith(PREVIEW_SUFFIX) && !NON_PREVIEW_HOSTS.has(hostname);
}

export function getLiffStatePath(): string | null {
  if (typeof window === "undefined") return null;
  const state = new URLSearchParams(window.location.search).get("liff.state");
  if (!state) return null;

  let decoded = state;
  try {
    decoded = decodeURIComponent(state);
  } catch {
    // URLSearchParams already decoded the common case.
  }

  try {
    return new URL(decoded, window.location.origin).pathname;
  } catch {
    return decoded.split(/[?#]/, 1)[0] || null;
  }
}

function isAiOfficeRoute(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/sweet/ai-office";
}

function isAccountRoute(): boolean {
  if (typeof window === "undefined") return false;
  return (window.location.pathname.replace(/\/+$/, "") || "/") === "/account";
}

export function isShopOwnerSession(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem("mytree_surface") === "shop";
}

function isShopOwnerPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/sweet/shop"
    || path === "/sweet/menu"
    || path === "/sweet/signup";
}

function isShopOwnerRoute(): boolean {
  if (typeof window === "undefined") return false;
  if (isShopOwnerPath(window.location.pathname)) return true;
  const liffStatePath = getLiffStatePath();
  return liffStatePath ? isShopOwnerPath(liffStatePath) : false;
}

function activeLiffId(): string {
  const shopSurface = isShopOwnerRoute() || (isAccountRoute() && isShopOwnerSession());
  if (isCloudflarePreviewHost() && shopSurface) {
    if (!STAGING_SHOP_LIFF_ID) throw new Error("staging_shop_liff_not_configured");
    return STAGING_SHOP_LIFF_ID;
  }
  if (shopSurface) return DEFAULT_SHOP_LIFF_ID;
  return LIFF_ID;
}

export function getShopOwnerLiffUrl(): string {
  const id = isCloudflarePreviewHost() ? STAGING_SHOP_LIFF_ID : DEFAULT_SHOP_LIFF_ID;
  return id ? `https://liff.line.me/${id}` : "/sweet/shop";
}

/** Anonymous client for public catalog/configuration reads. Never invokes LIFF. */
export const publicSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Initialise the environment-selected LIFF app exactly once. A hung
 * liff.init() (real-device observed) would otherwise leave liffReady a
 * permanently-pending cached promise, silently wedging every future
 * caller across the whole app (order submission, delivery quotes,
 * customer/profile lookups, etc.). Timing it out lets it reject instead
 * of hanging; only a successful init stays cached — a rejection clears
 * liffReady so the next caller gets a fresh retry rather than inheriting
 * a permanently-broken cache. */
export function initLiff(): Promise<void> {
  if (isPreviewCheckoutMapAuthBypassActive()) return Promise.resolve();

  if (isShopOwnerRoute() && typeof window !== "undefined") {
    window.sessionStorage.setItem("mytree_surface", "shop");
  }

  const authenticatedSurface =
    isAiOfficeRoute() ||
    isShopOwnerRoute() ||
    isAccountRoute();

  if (isOrderingPreview() && !authenticatedSurface) return Promise.resolve();
  const liffId = activeLiffId();
  if (!liffReady || liffReady.liffId !== liffId) {
    const promise = withTimeout(
      liff.init({
        liffId,
        // Public customer preview remains passive. Authenticated shop/admin
        // surfaces must establish the LINE session explicitly.
        withLoginOnExternalBrowser: isAiOfficeRoute() || isShopOwnerRoute() || isAccountRoute(),
      }),
      LIFF_INIT_TIMEOUT_MS,
      "เชื่อมต่อ LINE ไม่สำเร็จ (หมดเวลา) กรุณาลองใหม่",
    ).catch((err) => {
      if (liffReady?.liffId === liffId) liffReady = null;
      throw err;
    });
    liffReady = { liffId, promise };
  }
  return liffReady.promise;
}

/** Get a valid MyTree access token, logging in via LINE if needed. */
export async function getAccessToken(): Promise<string> {
  if (isPreviewCheckoutMapAuthBypassActive()) return "";
  const authenticatedSurface =
    isAiOfficeRoute() ||
    isShopOwnerRoute() ||
    isAccountRoute();
  if (isOrderingPreview() && !authenticatedSurface) return "";
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  await initLiff();
  if (!liff.isLoggedIn()) {
    // Raw preview browsing intentionally works outside LINE. Authenticated
    // actions are allowed only after the same preview is launched through its
    // configured staging LIFF URL.
    if (isOrderingPreview() && !authenticatedSurface) return "";

    if (isAccountRoute() && isShopOwnerSession()) {
      liff.login({ redirectUri: window.location.href });
      return "";
    }

    if (isShopOwnerRoute()) {
      const liffId = activeLiffId();
      if (!liff.isInClient() && isCloudflarePreviewHost()) {
        window.location.replace(`https://liff.line.me/${liffId}${window.location.pathname}`);
        return "";
      }
      liff.login({ redirectUri: window.location.href });
      return "";
    }

    if (isAiOfficeRoute()) {
      const current = new URL(window.location.href);
      const isLineWebView = /Line\//i.test(window.navigator.userAgent);
      const enteredViaLiff = current.searchParams.get("aiOfficeLiff") === "1";

      // A raw Pages URL opened from a LINE message can run in LINE's generic
      // in-app browser rather than a LIFF context. Re-enter through the LIFF
      // permanent link so the existing LINE account context is available.
      if (isLineWebView && !enteredViaLiff) {
        const liffUrl = new URL(`https://liff.line.me/${LIFF_ID}/sweet/ai-office`);
        liffUrl.searchParams.set("aiOfficeLiff", "1");
        window.location.replace(liffUrl.toString());
        return "";
      }

      liff.login({ redirectUri: window.location.href });
      return "";
    }

    liff.login();
    return "";
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    if (isOrderingPreview() && !authenticatedSurface) return "";
    if (isAccountRoute() && isShopOwnerSession()) {
      liff.login({ redirectUri: window.location.href });
      return "";
    }
    if (isShopOwnerRoute()) {
      liff.login({ redirectUri: window.location.href });
      return "";
    }
    if (isAiOfficeRoute()) {
      liff.login({ redirectUri: window.location.href });
      return "";
    }
    throw new Error("no LINE idToken");
  }

  const res = await fetch(AUTH_BROKER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error(`auth broker error: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };

  cached = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

/** The current MyTree customer_id (from the LINE-issued token), or null. */
export async function getCurrentCustomerId(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part));
    return payload.customer_id ?? null;
  } catch {
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
