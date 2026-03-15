/**
 * Core types for KnuckleAIGroup.
 * Align with sql/schema.sql.
 */

export interface Match {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
}

export interface Pick {
  match_id: string;
  pick_date?: string; // set when persisting (YYYY-MM-DD)
  predicted_outcome: string;
  win_probability: number;
  draw_risk: number;
  upset_risk: number;
  confidence_score: number;
  reasoning: string;
}

/** Pick with joined match data for display */
export interface PickWithMatch extends Pick {
  match?: Match | null;
}

export interface DailySnapshot {
  snapshot_date: string;
  top_10_json: PickWithMatch[];
}
