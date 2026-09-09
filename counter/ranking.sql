CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 9000),
  wins INTEGER NOT NULL CHECK (wins BETWEEN 0 AND 25),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS scores_leaderboard
  ON scores (score DESC, wins DESC, created_at ASC, id ASC);
