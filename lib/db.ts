/**
 * Supabase client for KnuckleAIGroup.
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env.
 * Set them in .env.local (e.g. your Supabase project URL and anon key).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Match, Pick, PickWithMatch, DailySnapshot } from "./types";

function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  return createClient(url, key);
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) _client = createSupabaseClient();
  return _client;
}

export function getSupabase(): SupabaseClient {
  return getClient();
}

/** Upsert matches (by id). */
export async function upsertMatches(matches: Match[], rawJsonByKey?: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const rows = matches.map((m) => ({
    id: m.id,
    league: m.league,
    home_team: m.home_team,
    away_team: m.away_team,
    start_time: m.start_time,
    home_odds: m.home_odds,
    draw_odds: m.draw_odds,
    away_odds: m.away_odds,
    raw_json: rawJsonByKey?.[m.id] ?? null,
  }));
  const { error } = await sb.from("matches").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Failed to upsert matches: ${error.message}`);
}

/** Delete picks for a given date. */
export async function deletePicksForDate(pickDate: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("picks").delete().eq("pick_date", pickDate);
  if (error) throw new Error(`Failed to delete picks for ${pickDate}: ${error.message}`);
}

/** Insert picks. */
export async function insertPicks(picks: Pick[]): Promise<void> {
  if (picks.length === 0) return;
  const sb = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const rows = picks.map((p) => ({
    match_id: p.match_id,
    pick_date: p.pick_date ?? today,
    predicted_outcome: p.predicted_outcome,
    win_probability: p.win_probability,
    draw_risk: p.draw_risk,
    upset_risk: p.upset_risk,
    confidence_score: p.confidence_score,
    reasoning: p.reasoning,
  }));
  const { error } = await sb.from("picks").insert(rows);
  if (error) throw new Error(`Failed to insert picks: ${error.message}`);
}

/** Upsert daily snapshot (one row per date). */
export async function upsertDailySnapshot(snapshot: DailySnapshot): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("daily_snapshots")
    .upsert(
      { snapshot_date: snapshot.snapshot_date, top_10_json: snapshot.top_10_json },
      { onConflict: "snapshot_date" }
    );
  if (error) throw new Error(`Failed to upsert daily snapshot: ${error.message}`);
}

/** Get today's picks with match data. Returns [] when Supabase env is missing (e.g. during build). */
export async function getTodayPicks(): Promise<PickWithMatch[]> {
  let sb: SupabaseClient;
  try {
    sb = getSupabase();
  } catch (e) {
    if (e instanceof Error && /missing supabase env/i.test(e.message)) return [];
    throw e;
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: snapshotRow, error: snapError } = await sb
    .from("daily_snapshots")
    .select("top_10_json")
    .eq("snapshot_date", today)
    .single();

  if (!snapError && snapshotRow?.top_10_json && Array.isArray(snapshotRow.top_10_json)) {
    return snapshotRow.top_10_json as PickWithMatch[];
  }

  const { data: picks, error: picksError } = await sb
    .from("picks")
    .select("*")
    .eq("pick_date", today)
    .order("confidence_score", { ascending: false });

  if (picksError) throw new Error(`Failed to fetch picks: ${picksError.message}`);
  if (!picks?.length) return [];

  const matchIds = Array.from(new Set(picks.map((p) => p.match_id)));
  const { data: matches, error: matchesError } = await sb
    .from("matches")
    .select("*")
    .in("id", matchIds);

  if (matchesError) throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  const matchMap = new Map((matches || []).map((m) => [m.id, m]));

  return picks.map((p) => ({
    ...p,
    match: matchMap.get(p.match_id) ?? null,
  })) as PickWithMatch[];
}
