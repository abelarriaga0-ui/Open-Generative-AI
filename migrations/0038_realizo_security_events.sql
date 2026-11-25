-- Aggregate security event counts; no raw IP, email, tokens or payloads.
CREATE TABLE IF NOT EXISTS realizo_security_events (
  hour_start INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_count INTEGER NOT NULL CHECK(event_count>0),
  PRIMARY KEY(hour_start,event_type)
);
