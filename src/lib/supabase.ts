import { createClient } from "@supabase/supabase-js";
import liff from "@line/liff";

// ============================================================
// MyTree — Supabase client wired to LINE LIFF auth (#5)
//
// Flow: LIFF login -> getIDToken -> POST /auth/line (broker) ->
//       Supabase JWT with customer_id claim -> attached to every request.
//
// The `accessToken` callback lets supabase-js fetch a fresh token whenever
// it needs one (auto-refresh). Every DB call then carries customer_id, so
// RLS / RPCs / rider signup / admin all work.
// ============================================================

const LIFF_ID = "2010936243-3kPykppE";
const AUTH_BROKER = "https://mytree-worker.kompakorn-t.workers.dev/auth/line";

let liffReady: Promise<void> | null = null;
let cached: { token: string; exp: number } | null = null;

/** Initialise LIFF exactly once. */
export function initLiff(): Promise<void> {
  if (!liffReady) liffReady = liff.init({ liffId: LIFF_ID });
  return liffReady;
}

/** Get a valid MyTree (Supabase) access token, logging in via LINE if needed. */
export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login(); // redirects to LINE; page reloads after login
    // return a dummy so the current (pre-redirect) call doesn't throw
    return "";
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("no LINE idToken");

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

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    accessToken: async () => (await getAccessToken()) || null,
  }
);
