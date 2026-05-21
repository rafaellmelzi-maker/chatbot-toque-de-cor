#!/usr/bin/env bash
# =============================================================
# Toque de Cor – Script de Setup Inicial
# Uso: bash scripts/setup.sh
# =============================================================
set -euo pipefail

CYAN="\033[0;36m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"

info()    { echo -e "${CYAN}[setup]${NC} $1"; }
success() { echo -e "${GREEN}[ok]${NC} $1"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $1"; }
error()   { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ── Pré-requisitos ────────────────────────────────────────────
command -v node >/dev/null 2>&1  || error "Node.js não encontrado. Instale Node 20+."
command -v npm  >/dev/null 2>&1  || error "npm não encontrado."
command -v docker >/dev/null 2>&1 || warn  "Docker não encontrado – você precisará rodar o banco manualmente."

# ── .env ─────────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "Copiando .env.example → .env"
  cp .env.example .env
  warn "Edite o arquivo .env com suas credenciais antes de continuar."
  warn "Pressione ENTER para continuar ou CTRL+C para sair e editar primeiro."
  read -r _
fi
success ".env pronto"

# ── Backend deps ─────────────────────────────────────────────
info "Instalando dependências do backend..."
(cd backend && npm install)
success "backend/node_modules instalado"

# ── Frontend deps ────────────────────────────────────────────
info "Instalando dependências do frontend..."
(cd frontend && npm install)
success "frontend/node_modules instalado"

# ── Docker ───────────────────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  info "Subindo PostgreSQL e Redis via Docker..."
  docker compose up -d postgres redis
  info "Aguardando PostgreSQL ficar pronto..."
  sleep 6
  success "Serviços de banco de dados iniciados"
fi

# ── Prisma ───────────────────────────────────────────────────
info "Rodando migrações do banco de dados..."
(cd backend && npx prisma migrate deploy)
success "Migrações aplicadas"

info "Gerando cliente Prisma..."
(cd backend && npx prisma generate)
success "Prisma client gerado"

# ── Seed ─────────────────────────────────────────────────────
info "Populando banco com dados iniciais (seed)..."
(cd backend && npx tsx prisma/seed.ts)
success "Seed concluído"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Setup concluído com sucesso!                   ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║   Credenciais padrão:                                ║${NC}"
echo -e "${GREEN}║   Admin:    admin@toquedeor.com.br / Admin@2024!     ║${NC}"
echo -e "${GREEN}║   Vendedor: vendedor@toquedeor.com.br / Vendedor@2024!║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║   Para iniciar em desenvolvimento:                   ║${NC}"
echo -e "${GREEN}║     Backend:  cd backend && npm run dev              ║${NC}"
echo -e "${GREEN}║     Frontend: cd frontend && npm run dev             ║${NC}"
echo -e "${GREEN}║   Ou com Docker Compose (produção):                  ║${NC}"
echo -e "${GREEN}║     docker compose up --build                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
