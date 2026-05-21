#!/usr/bin/env bash
# =============================================================
# Toque de Cor – Deploy em Produção
# Uso: bash scripts/deploy.sh
# =============================================================
set -euo pipefail

CYAN="\033[0;36m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"

info()    { echo -e "${CYAN}[deploy]${NC} $1"; }
success() { echo -e "${GREEN}[ok]${NC} $1"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $1"; }
error()   { echo -e "${RED}[error]${NC} $1"; exit 1; }

command -v docker >/dev/null 2>&1 || error "Docker é necessário para o deploy."

[ -f .env ] || error ".env não encontrado. Copie de .env.example e configure."

info "Parando containers antigos..."
docker compose down --remove-orphans

info "Baixando imagens mais recentes..."
docker compose pull postgres redis evolution

info "Construindo imagens da aplicação..."
docker compose build --no-cache backend frontend

info "Subindo todos os serviços..."
docker compose up -d

info "Aguardando backend ficar pronto (30s)..."
sleep 30

info "Rodando migrações de produção..."
docker compose exec backend npx prisma migrate deploy

success "Deploy concluído!"
echo ""
docker compose ps
