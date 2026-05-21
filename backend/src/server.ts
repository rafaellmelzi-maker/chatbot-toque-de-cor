import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';

async function bootstrap() {
  // ── Conexões ──────────────────────────────────────────────
  await redis.connect();
  await prisma.$connect();
  logger.info('✅ Banco de dados conectado');

  const { httpServer } = createApp();

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Servidor rodando na porta ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📡 API: http://localhost:${env.PORT}/api`);
    logger.info(`❤️  Health: http://localhost:${env.PORT}/api/health`);
  });

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Recebido sinal ${signal}, encerrando graciosamente...`);
    httpServer.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      logger.info('Servidor encerrado');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});
