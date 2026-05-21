// Este script é executado automaticamente pelo Docker ao iniciar o PostgreSQL
// Habilita a extensão pgvector para embeddings RAG
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
