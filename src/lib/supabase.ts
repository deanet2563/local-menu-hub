import { createClient } from "@supabase/supabase-js";
import liff from "@line/liff";
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
export const LIFF_ID = import.meta.env.VITE_LIFF_ID || DEFAULT_LIFF_ID;
const AUTH_BROKER = "https://mytree-worker.kompakorn-t.workers.dev/auth/line";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let liffReady: Promise<void> | null = null;
let cached: { token: string; exp: number } | null = null;

/** True only for the stable Ordering Flow v2 Cloudflare Pages preview alias. */
export function isOrderingPreview(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "mytree-ordering-flow-v2.local-menu-hub.pages.dev";
}

/** Anonymous client for public catalog/configuration reads. Never invokes LIFF. */
export const publicSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Initialise the environment-selected LIFF app exactly once. */
export function initLiff(): Promise<void> {
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
export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  await initLiff();
  if (!liff.isLoggedIn()) {
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
