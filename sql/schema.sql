-- KnuckleAIGroup football picks schema
-- PostgreSQL / Supabase. Run in Supabase SQL Editor.

-- Matches (from external odds API)
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  league TEXT,
  home_team TEXT,
  away_team TEXT,
  start_time TIMESTAMPTZ,
  home_odds NUMERIC,
  draw_odds NUMERIC,
  away_odds NUMERIC,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Picks (daily top picks per match)
CREATE TABLE IF NOT EXISTS picks (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  pick_date DATE,
  predicted_outcome TEXT,
  win_probability NUMERIC,
  draw_risk NUMERIC,
  upset_risk NUMERIC,
  confidence_score NUMERIC,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily snapshot of top 10 (denormalized)
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE UNIQUE,
  top_10_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_picks_pick_date ON picks(pick_date);
CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_snapshot_date ON daily_snapshots(snapshot_date);
