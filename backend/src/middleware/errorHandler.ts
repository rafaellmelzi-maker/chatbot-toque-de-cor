import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string;

  // AppError customizado
  if (err instanceof AppError) {
    logger.warn(`[${requestId}] AppError ${err.statusCode}: ${err.message}`);
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      requestId,
    });
  }

  // Erros de validação Zod
  if (err instanceof ZodError) {
    logger.warn(`[${requestId}] Validation error`);
    return res.status(422).json({
      success: false,
      error: 'Dados inválidos',
      details: err.flatten().fieldErrors,
      requestId,
    });
  }

  // Erros Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn(`[${requestId}] Prisma error ${err.code}: ${err.message}`);
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Registro duplicado. Este valor já existe.',
        requestId,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado.',
        requestId,
      });
    }
  }

  // Erros genéricos (não expõe detalhes em produção)
  logger.error(`[${requestId}] Unhandled error:`, { message: err.message, stack: err.stack });

  // Quota/rate limit da API de IA
  if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('Too Many Requests')) {
    return res.status(503).json({
      success: false,
      error: 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
      requestId,
    });
  }

  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
    requestId,
  });
}
