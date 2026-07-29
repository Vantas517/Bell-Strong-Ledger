import { createClient } from "@supabase/supabase-js";

// These two values come from your Supabase project (Settings -> API).
// They get set as "Environment Variables" in Vercel, not typed in here directly.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
});
