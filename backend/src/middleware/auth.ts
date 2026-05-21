import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';

export interface JwtPayload {
  sub: string;      // userId
  tenantId: string;
  role: string;
  storeId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Token de autenticação não fornecido', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    req.tenantId = payload.tenantId;
    next();
  } catch {
    next(new AppError('Token inválido ou expirado', 401));
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Não autenticado', 401));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AppError('Acesso não autorizado para este perfil', 403));
    }
    next();
  };
}

// Middleware para extrair tenantId do header ou do token
export function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  if (tenantId) req.tenantId = tenantId;
  next();
}

// Valida que o usuário pertence ao tenant
export async function validateTenantAccess(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || !req.tenantId) return next();

  if (req.user.role === 'SUPER_ADMIN') return next();

  if (req.user.tenantId !== req.tenantId) {
    return next(new AppError('Acesso negado a este tenant', 403));
  }

  // Verifica se o usuário ainda está ativo
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { isActive: true },
    });
    if (!user?.isActive) {
      return next(new AppError('Usuário desativado', 401));
    }
    next();
  } catch {
    next(new AppError('Erro ao validar usuário', 500));
  }
}
