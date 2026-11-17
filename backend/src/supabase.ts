import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | undefined;
let authClient: SupabaseClient | undefined;
let publicClient: SupabaseClient | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

export function getAuthClient(): SupabaseClient {
  if (!authClient) {
    authClient = createClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return authClient;
}

export function getPublicClient(): SupabaseClient {
  if (!publicClient) {
    publicClient = createClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return publicClient;
}
