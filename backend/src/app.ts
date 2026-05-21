import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { apiRouter } from './routes';

export function createApp(): { app: Application; httpServer: ReturnType<typeof createServer>; io: SocketServer } {
  const app = express();
  const httpServer = createServer(app);

  // ── Socket.IO ──────────────────────────────────────────────
  const io = new SocketServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    path: '/socket.io',
  });

  // ── Segurança ──────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-request-id'],
    }),
  );

  // ── Parsers ────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // ── Logging HTTP ───────────────────────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.url === '/api/health',
    }),
  );

  // ── Request ID ─────────────────────────────────────────────
  app.use(requestId);

  // ── Rotas ──────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── Health check ───────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
  });

  // ── Arquivos estáticos ────────────────────────────────────
  app.use('/uploads', express.static(env.UPLOAD_DIR));

  // ── Tratamento de erros ───────────────────────────────────
  app.use(errorHandler);

  // ── Socket.IO – salas por conversa ────────────────────────
  io.on('connection', (socket) => {
    logger.debug(`Socket conectado: ${socket.id}`);

    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket desconectado: ${socket.id}`);
    });
  });

  // Disponibiliza io globalmente para os services
  app.set('io', io);

  return { app, httpServer, io };
}
