-- Enable extensions used by the agent + dashboard.
-- Runs on first container boot via docker-entrypoint-initdb.d.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
