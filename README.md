# 🎨 Toque de Cor – Chatbot de Atendimento Inteligente

Sistema completo de atendimento via **WhatsApp e Web Chat** com IA generativa para a rede de tintas **Toque de Cor** (18 unidades).

---

## 📋 Visão Geral

| Componente | Tecnologia |
|---|---|
| Backend API | Node.js 20 + TypeScript + Express 4 |
| Banco de Dados | PostgreSQL 16 + pgvector |
| Cache / Queue | Redis 7 |
| IA | OpenAI GPT-4o + text-embedding-3-small |
| WhatsApp | Evolution API |
| Frontend (Admin) | React 18 + Vite 5 + Tailwind CSS |
| Deploy | Docker Compose + Nginx |

### Funcionalidades

- 🤖 Chatbot com GPT-4o para qualificação e recomendação técnica de tintas
- 📐 Calculadora de tinta integrada (área, rendimento, embalagens)
- 🔍 RAG (Retrieval-Augmented Generation) com catálogo de produtos via pgvector
- 📱 Integração WhatsApp via Evolution API
- 💬 Widget embeddable para sites
- 📊 Dashboard administrativo completo (métricas, gráficos, KPIs)
- 👥 Gestão de leads com pipeline Kanban
- 🔄 Transferência para humano com resumo automático gerado por IA
- 🏪 Multi-loja (18 unidades) com WhatsApp individual por loja

---

## 🚀 Setup Rápido

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- Chave de API OpenAI
- (Opcional) Conta Evolution API

### 1. Clone e configure

```bash
git clone <repo>
cd projeto_chatbot_toque_de_cor
cp .env.example .env
# edite .env com suas credenciais
```

### 2. Setup automático

```bash
bash scripts/setup.sh
```

Ou manualmente:

```bash
# Backend deps
cd backend && npm install

# Frontend deps  
cd frontend && npm install

# Subir banco de dados
docker compose up -d postgres redis

# Aplicar schema e seed
cd backend
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/seed.ts
```

### 3. Desenvolvimento local

```bash
# Terminal 1 – Backend
cd backend && npm run dev

# Terminal 2 – Frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/api/health

### 4. Produção com Docker

```bash
bash scripts/deploy.sh
# ou
docker compose up --build -d
```

---

## 🔑 Credenciais Padrão (seed)

| Usuário | E-mail | Senha | Papel |
|---|---|---|---|
| Admin | admin@toquedeor.com.br | Admin@2024! | ADMIN |
| Vendedor | vendedor@toquedeor.com.br | Vendedor@2024! | SELLER |

> ⚠️ **Altere as senhas em produção.**

---

## 🗂️ Estrutura do Projeto

```
projeto_chatbot_toque_de_cor/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Schema completo com pgvector
│   │   ├── seed.ts           # 18 lojas, produtos, usuários
│   │   └── init.sql          # Extensões PostgreSQL
│   ├── src/
│   │   ├── ai/               # Prompts e configuração de IA
│   │   ├── config/           # DB, Redis, OpenAI, env validation
│   │   ├── controllers/      # Todos os controllers REST
│   │   ├── middleware/        # Auth JWT, rate limit, error handler
│   │   ├── routes/           # Definição de todas as rotas
│   │   ├── services/         # Lógica de negócio
│   │   └── utils/            # Logger, calculadora de tinta
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/              # Clientes axios para cada recurso
│   │   ├── components/       # Layout, Sidebar, Header, StatsCard
│   │   ├── pages/            # Dashboard, Conversations, Leads, Products, Stores, Settings
│   │   └── store/            # Zustand (authStore)
│   └── Dockerfile
├── widget/
│   ├── index.html            # Demo do widget
│   ├── chat-widget.js        # Widget embeddable (Vanilla JS)
│   └── chat-widget.css       # Estilos do widget
├── nginx/
│   └── nginx.conf            # Proxy reverso + SSL + rate limiting
├── scripts/
│   ├── setup.sh              # Setup inicial automatizado
│   └── deploy.sh             # Deploy em produção
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🌐 Variáveis de Ambiente

Veja [.env.example](.env.example) para a lista completa. Principais:

```env
# Banco
DATABASE_URL=postgresql://toque_user:senha@localhost:5432/toque_de_cor_db

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-...

# JWT
JWT_SECRET=sua-chave-secreta-muito-longa-aqui

# Evolution API (WhatsApp)
EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_API_KEY=sua-chave-evolution
WEBHOOK_SECRET=segredo-para-validar-webhooks
```

---

## 📡 API – Endpoints Principais

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login com e-mail e senha |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Revogar refresh token |
| GET | `/api/auth/me` | Dados do usuário autenticado |

### Chat (Widget / WhatsApp)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/chat/start` | Iniciar conversa (cria/recupera sessão) |
| POST | `/api/chat/:id/message` | Enviar mensagem e receber resposta da IA |
| GET | `/api/chat/:id/history` | Histórico da conversa |

### Conversas (Admin)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversations` | Listar com filtros (status, loja, página) |
| GET | `/api/conversations/:id` | Detalhe com mensagens |
| PATCH | `/api/conversations/:id/transfer` | Assumir conversa (transferir para humano) |
| PATCH | `/api/conversations/:id/resolve` | Marcar como resolvida |
| POST | `/api/conversations/:id/messages` | Enviar mensagem como atendente |

### Leads
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/leads` | Listar leads com filtros |
| PATCH | `/api/leads/:id/status` | Atualizar status do lead |

### Produtos
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/products` | Listar produtos (com paginação/busca) |
| POST | `/api/products` | Criar produto |
| PUT | `/api/products/:id` | Atualizar produto |
| POST | `/api/products/:id/embedding` | Gerar embedding para RAG |

### WhatsApp Webhook
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/webhooks/whatsapp` | Receber eventos da Evolution API |

---

## 🤖 Como a IA Funciona

1. **Mensagem recebida** → salva no banco
2. **Detecção de intenção** (GPT-4o-mini) → extrai: superfície, ambiente, área, cor, acabamento, orçamento, tipo de projeto, `purchaseScore` (0-100)
3. **RAG** → gera embedding da mensagem, busca produtos similares via pgvector (cosine similarity)
4. **Prompt dinâmico** → monta system prompt com contexto do cliente + produtos encontrados
5. **Resposta** (GPT-4o) → aplica guardrails (não revela que é IA, trunca em 1500 chars)
6. **Calculadora** → se área conhecida, adiciona cálculo de embalagens recomendadas
7. **Lead capture** → se `purchaseScore` ≥ 50, cria lead automaticamente
8. **Transferência** → se `shouldTransfer=true` ou score alto, gera resumo executivo e notifica atendente

---

## 💬 Integração do Widget no Site

```html
<!-- Adicione antes de </body> -->
<script>
  window.ToqueDeCor = {
    apiUrl: 'https://app.toquedeor.com.br',
    storeId: 'UUID_DA_LOJA', // opcional
  };
</script>
<script src="https://app.toquedeor.com.br/widget/chat-widget.js" defer></script>
```

---

## 📊 Dashboard – Métricas Disponíveis

- Total de conversas e conversas ativas (tempo real)
- Total de leads e taxa de conversão
- Gráfico de conversas por dia (30 dias)
- Funil de leads por status (doughnut chart)
- Top produtos recomendados pela IA
- Desempenho comparativo por loja

---

## 🔒 Segurança

- JWT com access token (15min) + refresh token (7 dias, armazenado no DB)
- Senhas com bcrypt (salt rounds 12)
- HMAC SHA-256 para validação de webhooks da Evolution API
- Rate limiting por rota (auth: 10/15min, api: 30/min, webhooks: 300/min)
- Helmet.js para headers HTTP seguros
- CORS configurado com domínios específicos
- HTTPS forçado via Nginx com TLS 1.2/1.3
- Sem secrets em logs de produção

---

## 🐳 Docker Compose – Serviços

| Serviço | Imagem | Porta |
|---|---|---|
| postgres | pgvector/pgvector:pg16 | 5432 |
| redis | redis:7-alpine | 6379 |
| backend | (build local) | 3001 |
| frontend | (build local) | 3000 |
| evolution | atendai/evolution-api:latest | 8080 |
| nginx | nginx:alpine | 80, 443 |

---

## 📄 Licença

Proprietário – Toque de Cor © 2024. Todos os direitos reservados.
