# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production ────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh

RUN mkdir -p uploads logs && chmod +x entrypoint.sh

EXPOSE 3001
CMD ["sh", "entrypoint.sh"]

# ── Development ───────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app
ENV NODE_ENV=development

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate

RUN mkdir -p uploads logs

EXPOSE 3001
CMD ["npm", "run", "dev"]
