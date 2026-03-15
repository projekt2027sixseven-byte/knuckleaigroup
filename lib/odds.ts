/**
 * Fetches today's football matches from an external odds API.
 *
 * IMPORTANT: The API response shape is provider-specific. This module does NOT assume
 * a particular structure. You must map your API's response to Match in the places
 * marked below (parseApiResponse, normalizeEvent, extractOdds).
 *
 * Environment: ODDS_API_KEY must be set in .env.local.
 */

import type { Match } from "./types";

/**
 * Fetches today's football matches and returns normalized Match[].
 * - Reads ODDS_API_KEY from process.env.
 * - Fetches from the external API (URL/params are placeholders — adapt to your provider).
 * - Maps response to Match via parseApiResponse → normalizeEvent → extractOdds.
 */
export async function fetchTodayMatches(): Promise<Match[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ODDS_API_KEY. Set it in .env.local. Get a key from your odds API provider."
    );
  }

  const baseUrl = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com";
  // --- MAP: Replace URL and query params with your API's endpoint and required params ---
  const url = `${baseUrl}/v4/sports/soccer_epl/odds?apiKey=${apiKey}&regions=uk&markets=h2h`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 0 } });
  } catch (err) {
    throw new Error(`Odds API request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Odds API returned ${res.status}: ${text.slice(0, 200)}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Odds API response was not valid JSON.");
  }

  return parseApiResponse(data);
}

/**
 * MAP: Where the API response is turned into an array of events.
 *
 * Your API might return:
 * - A root array of events
 * - An object with a property that holds the array, e.g. { data: [...] }, { events: [...] }, { results: [...] }
 *
 * Adapt the next lines to read the correct property (or use the root) so that `events`
 * is the array of raw match/event objects your API returns.
 */
function parseApiResponse(data: unknown): Match[] {
  if (!data || typeof data !== "object") {
    throw new Error("Odds API response is not an object.");
  }

  const obj = data as Record<string, unknown>;
  // --- MAP: Set eventsArray to the array of events in your API response ---
  const eventsArray =
    Array.isArray(data) ? data
    : Array.isArray(obj.data) ? obj.data
    : Array.isArray(obj.events) ? obj.events
    : Array.isArray(obj.results) ? obj.results
    : null;

  if (!Array.isArray(eventsArray)) {
    throw new Error(
      "Odds API response does not contain an array of events. " +
        "In parseApiResponse(), map your API's response to the array of events (e.g. data, events, or root)."
    );
  }

  return eventsArray.map((ev) => normalizeEvent(ev)).filter((m): m is Match => m !== null);
}

/**
 * MAP: One raw API event → Match.
 *
 * Match fields and where they must come from in your API:
 *
 *   Match.id          → unique event id (e.g. event.id, event_id, game_id)
 *   Match.league      → competition/league name or key (e.g. sport_key, league, competition)
 *   Match.home_team   → home team name (e.g. home_team, teams[0], team_home)
 *   Match.away_team   → away team name (e.g. away_team, teams[1], team_away)
 *   Match.start_time  → ISO datetime string (e.g. commence_time, start_time, date)
 *   Match.home_odds   → decimal odds for home win (see extractOdds)
 *   Match.draw_odds   → decimal odds for draw (see extractOdds)
 *   Match.away_odds   → decimal odds for away win (see extractOdds)
 *
 * Replace the fallback keys below with your API's actual property names.
 */
function normalizeEvent(ev: unknown): Match | null {
  if (!ev || typeof ev !== "object") return null;
  const o = ev as Record<string, unknown>;

  // --- MAP: id — your API's unique event identifier ---
  const id = safeString(o.id ?? o.event_id ?? o.game_id);

  // --- MAP: home_team, away_team — your API's team fields or array indices ---
  const home_team = safeString(o.home_team ?? (Array.isArray(o.teams) ? o.teams[0] : null) ?? o.team_home);
  const away_team = safeString(o.away_team ?? (Array.isArray(o.teams) ? o.teams[1] : null) ?? o.team_away);

  // --- MAP: start_time — your API's start datetime (ISO string preferred) ---
  const start_time = safeString(o.commence_time ?? o.start_time ?? o.commenceTime ?? o.date);

  // --- MAP: league — your API's sport/league/competition ---
  const league = safeString(o.sport_key ?? o.league ?? o.competition ?? o.sport_title ?? "Unknown");

  if (!id || !home_team || !away_team || !start_time) {
    return null;
  }

  const { home_odds, draw_odds, away_odds } = extractOdds(o);

  return {
    id,
    league,
    home_team,
    away_team,
    start_time,
    home_odds,
    draw_odds,
    away_odds,
  };
}

/**
 * MAP: Extract decimal odds from one event object.
 *
 * Your API might have:
 * - Top-level: event.home_odds, event.draw_odds, event.away_odds
 * - Nested: event.bookmakers[0].markets[0].outcomes (each outcome has name/price or team/price)
 * - Or another structure — adapt the logic below to read home/draw/away decimal odds.
 */
function extractOdds(o: Record<string, unknown>): {
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
} {
  // --- MAP: If your API has top-level odds, use them here ---
  if (typeof o.home_odds === "number" && typeof o.away_odds === "number") {
    return {
      home_odds: o.home_odds,
      draw_odds: typeof o.draw_odds === "number" ? o.draw_odds : null,
      away_odds: o.away_odds,
    };
  }

  // --- MAP: If your API nests odds under bookmakers/odds and markets/outcomes ---
  const bookmakers = o.bookmakers ?? o.odds ?? o.prices;
  if (!Array.isArray(bookmakers) || bookmakers.length === 0) {
    return { home_odds: null, draw_odds: null, away_odds: null };
  }

  const first = bookmakers[0] as Record<string, unknown>;
  const markets = first.markets ?? first.market;
  const marketList = Array.isArray(markets) ? markets : markets ? [markets] : [];

  let home_odds: number | null = null;
  let draw_odds: number | null = null;
  let away_odds: number | null = null;

  for (const m of marketList) {
    const market = m as Record<string, unknown>;
    const outcomes = market.outcomes ?? market.outcome;
    const outcomeList = Array.isArray(outcomes) ? outcomes : outcomes ? [outcomes] : [];

    for (const out of outcomeList) {
      const outcome = out as Record<string, unknown>;
      const price = typeof outcome.price === "number" ? outcome.price : null;
      if (price == null) continue;
      // --- MAP: Match outcome name/type to home, draw, away (your API may use different labels) ---
      const name = String(outcome.name ?? outcome.team ?? outcome.type ?? "").toLowerCase();
      if (name === "draw") draw_odds = price;
      else if (name.includes("home") || name === "team1" || name === "1") home_odds = price;
      else if (name.includes("away") || name === "team2" || name === "2") away_odds = price;
    }
    if (home_odds != null || draw_odds != null || away_odds != null) break;
  }

  return { home_odds, draw_odds, away_odds };
}

function safeString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}
