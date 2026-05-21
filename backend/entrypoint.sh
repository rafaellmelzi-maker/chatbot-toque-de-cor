#!/bin/sh
# Entrypoint de produção – aplica schema antes de iniciar o servidor
set -e

echo "[entrypoint] Aplicando schema Prisma..."
npx prisma db push --accept-data-loss

echo "[entrypoint] Iniciando servidor..."
exec node dist/server.js
