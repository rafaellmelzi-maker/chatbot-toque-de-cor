import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('✅ Redis conectado'));
redis.on('error', (err) => logger.error('❌ Redis erro:', err));

export const SESSION_TTL = 60 * 60 * 24; // 24 horas
export const CACHE_TTL = 60 * 15; // 15 minutos

export async function getCache<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? (JSON.parse(data) as T) : null;
}

export async function setCache(key: string, value: unknown, ttl = CACHE_TTL): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

export async function deletePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
