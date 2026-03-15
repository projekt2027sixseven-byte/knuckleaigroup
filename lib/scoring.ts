/**
 * Rule-based scoring for football matches.
 * Input: decimal odds (home, draw, away).
 * Output: implied & normalized probabilities, predicted outcome, draw risk, upset risk,
 * confidence (0–100), and reasoning.
 * No ML — simple formulas, easy to tune.
 */

export interface ScoringInput {
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
}

export interface ScoringResult {
  predicted_outcome: string;
  win_probability: number;
  draw_risk: number;
  upset_risk: number;
  confidence_score: number; // 0–100
  reasoning: string;
}

// --- Tuning constants (adjust as needed) ---
const MIN_ODDS = 1.01;
const MAX_ODDS = 100;
/** Weight for draw risk in confidence (0–1). */
const DRAW_RISK_WEIGHT = 0.5;
/** Weight for upset risk in confidence (0–1). */
const UPSET_RISK_WEIGHT = 0.5;

function clampOdds(v: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(MIN_ODDS, Math.min(MAX_ODDS, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isNaN(v) ? 0 : v));
}

/**
 * Implied probability from decimal odds: 1 / odds.
 * Normalized so home + draw + away = 1.
 */
function impliedAndNormalized(
  home: number,
  draw: number,
  away: number
): { home: number; draw: number; away: number } {
  const h = home > 0 ? 1 / home : 0;
  const d = draw > 0 ? 1 / draw : 0;
  const a = away > 0 ? 1 / away : 0;
  const sum = h + d + a;
  if (sum <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return {
    home: h / sum,
    draw: d / sum,
    away: a / sum,
  };
}

/**
 * Score one match from its odds.
 * - Predicted outcome = outcome with highest normalized probability.
 * - Draw risk = normalized probability of draw.
 * - Upset risk = probability that the favorite does not win (1 - win_probability).
 * - Confidence (0–100) = win probability reduced by draw and upset risk, scaled to 0–100.
 */
export function scoreMatch(input: ScoringInput): ScoringResult {
  const home = clampOdds(input.home_odds ?? 0);
  const draw = clampOdds(input.draw_odds ?? 0);
  const away = clampOdds(input.away_odds ?? 0);

  if (home <= 0 && draw <= 0 && away <= 0) {
    return {
      predicted_outcome: "Unknown",
      win_probability: 0,
      draw_risk: 1,
      upset_risk: 1,
      confidence_score: 0,
      reasoning: "No valid odds available.",
    };
  }

  // Implied probabilities, normalized to sum to 1
  const { home: pHome, draw: pDraw, away: pAway } = impliedAndNormalized(home, draw, away);

  const maxProb = Math.max(pHome, pDraw, pAway);
  let predicted_outcome: string;
  let win_probability: number;

  if (maxProb === pHome) {
    predicted_outcome = "Home";
    win_probability = pHome;
  } else if (maxProb === pAway) {
    predicted_outcome = "Away";
    win_probability = pAway;
  } else {
    predicted_outcome = "Draw";
    win_probability = pDraw;
  }

  const draw_risk = clamp01(pDraw);
  const upset_risk = clamp01(1 - maxProb);

  // Confidence: win probability penalized by draw/upset risk, then scaled 0–100
  const rawConfidence =
    win_probability *
    (1 - DRAW_RISK_WEIGHT * draw_risk) *
    (1 - UPSET_RISK_WEIGHT * upset_risk);
  const confidence_score = Math.round(clamp01(rawConfidence) * 100);

  const reasoning = buildReasoning(
    predicted_outcome,
    win_probability,
    draw_risk,
    upset_risk,
    pHome,
    pDraw,
    pAway
  );

  return {
    predicted_outcome,
    win_probability: Math.round(win_probability * 1000) / 1000,
    draw_risk: Math.round(draw_risk * 1000) / 1000,
    upset_risk: Math.round(upset_risk * 1000) / 1000,
    confidence_score,
    reasoning,
  };
}

function buildReasoning(
  outcome: string,
  winProb: number,
  drawRisk: number,
  upsetRisk: number,
  pHome: number,
  pDraw: number,
  pAway: number
): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const parts: string[] = [];
  parts.push(`Implied (normalized): Home ${pct(pHome)}, Draw ${pct(pDraw)}, Away ${pct(pAway)}.`);
  parts.push(`Pick: ${outcome} (win probability ${pct(winProb)}).`);
  parts.push(`Draw risk ${pct(drawRisk)}, upset risk ${pct(upsetRisk)}.`);
  return parts.join(" ");
}
