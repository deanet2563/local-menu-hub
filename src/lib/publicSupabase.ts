import { createClient } from "@supabase/supabase-js";

// Anonymous catalog client for routes that must remain public. Keep this in a
// LIFF-free module so importing Home, Shop, or Map cannot initialize LINE auth.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const publicSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
