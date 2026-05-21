#!/bin/bash
# =============================================================
# vps-firstboot.sh — Configuração pós-instalação no servidor
# Execute UMA VEZ após editar o .env:
#   bash /opt/toque-de-cor/scripts/vps-firstboot.sh
# =============================================================
set -euo pipefail

DIR="/opt/toque-de-cor"
cd "$DIR"

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[erro]${NC} $1"; exit 1; }

# ── Verificar .env ────────────────────────────────────────────
if grep -q "TROQUE_ESTA_SENHA_AGORA\|GERE_UMA_STRING\|ADICIONAR_DEPOIS" .env; then
  fail "Edite o .env antes de continuar: nano $DIR/.env"
fi
ok ".env configurado"

# ── Gerar segredos automaticamente se ainda forem placeholders ──
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 24)
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH|" .env
sed -i "s|WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$WEBHOOK_SECRET|" .env
ok "Segredos JWT e Webhook gerados automaticamente"

# ── Subir serviços ────────────────────────────────────────────
echo ""
warn "Subindo containers (pode demorar alguns minutos no primeiro build)..."
docker compose -f docker-compose.vps.yml up -d --build
ok "Containers iniciados"

# ── Aguardar banco ────────────────────────────────────────────
echo ""
warn "Aguardando PostgreSQL ficar pronto..."
sleep 15

# ── Rodar seed ───────────────────────────────────────────────
echo ""
warn "Executando seed (lojas, produtos, usuários padrão)..."
docker compose -f docker-compose.vps.yml exec -T backend npx tsx prisma/seed.ts || \
  warn "Seed já foi executado anteriormente (normal)."
ok "Seed concluído"

# ── IP do servidor ────────────────────────────────────────────
PUBLIC_IP=$(curl -s ifconfig.me)

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  TOQUE DE COR — INSTALAÇÃO CONCLUÍDA!               ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║   API:       http://$PUBLIC_IP/api/health                ║${NC}"
echo -e "${GREEN}║   Dashboard: configure VITE_API_URL na Vercel            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║   Login padrão:                                          ║${NC}"
echo -e "${GREEN}║   admin@toquedeor.com.br  /  Admin@2024!                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║   Próximos passos:                                       ║${NC}"
echo -e "${GREEN}║   1. Adicione OPENAI_API_KEY no .env e reinicie          ║${NC}"
echo -e "${GREEN}║      docker compose -f docker-compose.vps.yml restart    ║${NC}"
echo -e "${GREEN}║   2. Configure VITE_API_URL=http://$PUBLIC_IP na Vercel  ║${NC}"
echo -e "${GREEN}║   3. Conecte o WhatsApp via painel > Lojas               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
