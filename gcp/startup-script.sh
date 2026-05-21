#!/bin/bash
# =============================================================
# Google Cloud — Startup Script para Toque de Cor
# Colado em: Compute Engine > VM > Management > Startup script
# Região recomendada: southamerica-east1 (São Paulo)
# Máquina recomendada: e2-medium (2 vCPU, 4GB RAM) ~$34/mês
# =============================================================
set -euo pipefail

LOG="/var/log/toque-de-cor-setup.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== [$(date)] Iniciando setup Toque de Cor ==="

# ── Atualizar sistema ─────────────────────────────────────────
apt-get update -y
apt-get install -y curl git ufw

# ── Instalar Docker ───────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker instalado."
fi

# ── Firewall ──────────────────────────────────────────────────
# Nota: no GCP as regras principais ficam no VPC Firewall.
# O ufw aqui é uma camada adicional dentro da VM.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── Clonar repositório ────────────────────────────────────────
if [ ! -d /opt/toque-de-cor ]; then
  git clone https://github.com/rafaellmelzi-maker/chatbot-toque-de-cor.git /opt/toque-de-cor
fi
cd /opt/toque-de-cor

# ── Criar .env inicial ────────────────────────────────────────
if [ ! -f /opt/toque-de-cor/.env ]; then
  # Gerar segredos aleatórios automaticamente
  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH=$(openssl rand -hex 32)
  POSTGRES_PASS=$(openssl rand -hex 16)
  WEBHOOK_SECRET=$(openssl rand -hex 24)
  EVOLUTION_KEY=$(openssl rand -hex 16)

  cat > /opt/toque-de-cor/.env << EOF
NODE_ENV=production
PORT=3001

POSTGRES_USER=toque_user
POSTGRES_PASSWORD=${POSTGRES_PASS}
POSTGRES_DB=toque_de_cor_db

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}

# IMPORTANTE: adicione sua chave OpenAI depois
OPENAI_API_KEY=ADICIONAR_DEPOIS

EVOLUTION_API_KEY=${EVOLUTION_KEY}
WEBHOOK_SECRET=${WEBHOOK_SECRET}

# Atualize com a URL do seu frontend Vercel depois
FRONTEND_URL=http://localhost:3000

LOG_LEVEL=info
EOF
  echo "Arquivo .env criado com segredos gerados automaticamente."
fi

# ── Subir containers ──────────────────────────────────────────
cd /opt/toque-de-cor
docker compose -f docker-compose.vps.yml up -d --build

# ── Aguardar banco e rodar seed ───────────────────────────────
echo "Aguardando PostgreSQL (30s)..."
sleep 30

docker compose -f docker-compose.vps.yml exec -T backend \
  npx tsx prisma/seed.ts 2>&1 || echo "Seed ignorado (provavelmente já executado)."

# ── Salvar senhas geradas ──────────────────────────────────────
PUBLIC_IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip \
  2>/dev/null || curl -s ifconfig.me)

cat > /root/credenciais-toque-de-cor.txt << EOF
=== TOQUE DE COR — CREDENCIAIS GERADAS ===
Data: $(date)
IP Público: ${PUBLIC_IP}

API: http://${PUBLIC_IP}/api/health
Dashboard: configure VITE_API_URL=http://${PUBLIC_IP} na Vercel

Login padrão do sistema:
  admin@toquedeor.com.br / Admin@2024!
  vendedor@toquedeor.com.br / Vendedor@2024!

.env em: /opt/toque-de-cor/.env

PRÓXIMOS PASSOS:
1. Adicione a OPENAI_API_KEY no .env
2. Atualize FRONTEND_URL com a URL da Vercel
3. Reinicie: docker compose -f docker-compose.vps.yml restart backend
EOF

echo ""
echo "=== Setup concluído! ==="
echo "API disponível em: http://${PUBLIC_IP}/api/health"
echo "Credenciais salvas em: /root/credenciais-toque-de-cor.txt"
echo "Log completo em: ${LOG}"
