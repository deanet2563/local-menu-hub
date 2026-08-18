import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { getAccessToken } from './tokenStore';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// MyTree currently mints its own Supabase-compatible JWT through the Worker.
// Native must use that same authorization boundary instead of inventing a
// second Supabase Auth identity model or bypassing RLS.
export const supabase = createClient(url, anonKey, {
  accessToken: async () => getAccessToken(),
});
