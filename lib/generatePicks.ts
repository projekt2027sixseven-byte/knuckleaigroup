/**
 * Shared daily picks generation logic.
 * Used by scripts/generateDailyPicks.ts and app/api/generate-picks/route.ts.
 */

import { fetchTodayMatches } from "./odds";
import { scoreMatch } from "./scoring";
import type { Match, Pick, PickWithMatch, DailySnapshot } from "./types";
import {
  upsertMatches,
  deletePicksForDate,
  insertPicks,
  upsertDailySnapshot,
} from "./db";

const TOP_N = 10;

export interface GenerateResult {
  success: boolean;
  message: string;
  picksCount?: number;
  error?: string;
}

export async function runDailyGeneration(): Promise<GenerateResult> {
  const today = new Date().toISOString().slice(0, 10);

  let matches: Match[];
  try {
    matches = await fetchTodayMatches();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to fetch matches", error: message };
  }

  if (matches.length === 0) {
    return { success: true, message: "No matches to score.", picksCount: 0 };
  }

  try {
    await upsertMatches(matches);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to upsert matches", error: message };
  }

  const scored: { match: Match; pick: Pick }[] = matches.map((match) => {
    const result = scoreMatch({
      home_odds: match.home_odds,
      draw_odds: match.draw_odds,
      away_odds: match.away_odds,
    });
    return {
      match,
      pick: {
        match_id: match.id,
        pick_date: today,
        predicted_outcome: result.predicted_outcome,
        win_probability: result.win_probability,
        draw_risk: result.draw_risk,
        upset_risk: result.upset_risk,
        confidence_score: result.confidence_score,
        reasoning: result.reasoning,
      },
    };
  });

  scored.sort((a, b) => b.pick.confidence_score - a.pick.confidence_score);
  const top10 = scored.slice(0, TOP_N);
  const picksToInsert = top10.map((s) => s.pick);

  try {
    await deletePicksForDate(today);
    await insertPicks(picksToInsert);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to replace picks", error: message };
  }

  const top10WithMatch: PickWithMatch[] = top10.map((s) => ({
    ...s.pick,
    match: s.match,
  }));

  const snapshot: DailySnapshot = {
    snapshot_date: today,
    top_10_json: top10WithMatch,
  };

  try {
    await upsertDailySnapshot(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to upsert daily snapshot", error: message };
  }

  return { success: true, message: "Picks generated.", picksCount: top10.length };
}
