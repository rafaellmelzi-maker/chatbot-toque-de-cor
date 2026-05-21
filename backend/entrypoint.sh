#!/bin/sh
# Entrypoint de produção – roda migrações antes de iniciar o servidor
set -e

echo "[entrypoint] Rodando migrações Prisma..."
npx prisma migrate deploy

echo "[entrypoint] Iniciando servidor..."
exec node dist/server.js
