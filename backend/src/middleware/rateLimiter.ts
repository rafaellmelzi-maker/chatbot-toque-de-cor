import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const defaultRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente mais tarde.',
  },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: {
    success: false,
    error: 'Muitas tentativas de login. Aguarde 15 minutos.',
  },
});

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: {
    success: false,
    error: 'Rate limit de webhook excedido.',
  },
});
