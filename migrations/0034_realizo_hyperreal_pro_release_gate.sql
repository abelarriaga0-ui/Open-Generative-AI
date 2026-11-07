-- Explicit feature gate: no customer funds may be reserved until a complete,
-- independently verified background runner and final video delivery are active.
CREATE TABLE IF NOT EXISTS realizo_hyperreal_pro_release_gate (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  engine_version TEXT NOT NULL DEFAULT 'not-verified',
  approved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO realizo_hyperreal_pro_release_gate(slot,enabled) VALUES(1,0);
