/**
 * Daily picks generator script.
 * Run: npm run generate-picks (or npx tsx scripts/generateDailyPicks.ts)
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ODDS_API_KEY.
 */

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchTodayMatches } from "../lib/odds";
import { scoreMatch } from "../lib/scoring";
import type { Match, Pick, PickWithMatch, DailySnapshot } from "../lib/types";
import {
  upsertMatches,
  deletePicksForDate,
  insertPicks,
  upsertDailySnapshot,
} from "../lib/db";

const TOP_N = 10;
const LOG = "[generateDailyPicks]";

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`${LOG} Date: ${today}`);

  // 1. Fetch matches
  let matches: Match[];
  try {
    matches = await fetchTodayMatches();
    console.log(`${LOG} Fetched ${matches.length} matches.`);
  } catch (err) {
    console.error(`${LOG} Step 1 (fetch matches) failed:`, err);
    throw err;
  }

  if (matches.length === 0) {
    console.log(`${LOG} No matches to process. Exiting.`);
    return;
  }

  // 2. Store matches in database
  try {
    await upsertMatches(matches);
    console.log(`${LOG} Stored ${matches.length} matches in database.`);
  } catch (err) {
    console.error(`${LOG} Step 2 (store matches) failed:`, err);
    throw err;
  }

  // 3. Score matches
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
  console.log(`${LOG} Scored ${scored.length} matches.`);

  // 4. Sort by confidence score (descending)
  scored.sort((a, b) => b.pick.confidence_score - a.pick.confidence_score);

  // 5. Keep top 10
  const top10 = scored.slice(0, TOP_N);
  console.log(`${LOG} Top ${top10.length} picks by confidence.`);

  // 6. Delete existing picks for today
  try {
    await deletePicksForDate(today);
    console.log(`${LOG} Deleted existing picks for ${today}.`);
  } catch (err) {
    console.error(`${LOG} Step 6 (delete existing picks) failed:`, err);
    throw err;
  }

  // 7. Insert new picks
  const picksToInsert = top10.map((s) => s.pick);
  try {
    await insertPicks(picksToInsert);
    console.log(`${LOG} Inserted ${picksToInsert.length} picks.`);
  } catch (err) {
    console.error(`${LOG} Step 7 (insert picks) failed:`, err);
    throw err;
  }

  // 8. Store snapshot in daily_snapshots
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
    console.log(`${LOG} Stored daily snapshot for ${today}.`);
  } catch (err) {
    console.error(`${LOG} Step 8 (store snapshot) failed:`, err);
    throw err;
  }

  console.log(`${LOG} Done.`);
  top10.forEach((s, i) => {
    console.log(
      `  ${i + 1}. ${s.match.home_team} v ${s.match.away_team} -> ${s.pick.predicted_outcome} (confidence: ${s.pick.confidence_score})`
    );
  });
}

main().catch((err) => {
  console.error(`${LOG} Fatal:`, err);
  process.exit(1);
});
