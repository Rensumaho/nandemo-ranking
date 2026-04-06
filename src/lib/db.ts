import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseErrorResult = {
  error: { message: string } | null;
};

type SupabaseDataResult<T> = SupabaseErrorResult & {
  data: T | null;
};

function getRequiredEnv(candidates: string[]): string {
  for (const name of candidates) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }
  throw new Error(`Missing environment variable. Set one of: ${candidates.join(", ")}`);
}

function getSupabaseUrl(): string {
  return getRequiredEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
}

function getSupabaseServiceRoleKey(): string {
  return getRequiredEnv(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]);
}

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminClient;
}

export function throwIfSupabaseError(result: SupabaseErrorResult, context: string): void {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
}

export function requireSupabaseData<T>(result: SupabaseDataResult<T>, context: string): T {
  throwIfSupabaseError(result, context);
  if (result.data === null) {
    throw new Error(`${context}: no data returned`);
  }
  return result.data;
}
