-- Script executado uma vez para habilitar extensões no PostgreSQL do Railway
-- Execute via: psql $DATABASE_URL -f scripts/railway-db-setup.sql
-- Ou pelo Railway Shell: psql $DATABASE_URL

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm');
