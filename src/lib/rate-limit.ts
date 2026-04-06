import { getSupabaseAdminClient, requireSupabaseData } from "@/lib/db";

export async function canCreateScoreRequest(anonId: string) {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("score_change_requests")
    .select("created_at")
    .eq("created_by_anon_id", anonId)
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = requireSupabaseData(result, "Failed to check score request rate limit") as Array<{
    created_at: string;
  }>;

  if (rows.length === 0) {
    return true;
  }

  const lastAt = new Date(rows[0].created_at).getTime();
  return Date.now() - lastAt >= 5 * 60 * 1000;
}

export async function canCreateComment(anonId: string) {
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("comments")
    .select("created_at")
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = requireSupabaseData(result, "Failed to check comment rate limit") as Array<{
    created_at: string;
  }>;

  if (rows.length === 0) {
    return true;
  }

  const lastAt = new Date(rows[0].created_at).getTime();
  return Date.now() - lastAt >= 30 * 1000;
}
