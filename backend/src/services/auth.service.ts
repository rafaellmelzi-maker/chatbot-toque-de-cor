import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { JwtPayload } from '../middleware/auth';

export class AuthService {
  async login(email: string, password: string, tenantSlug?: string) {
    const tenant = tenantSlug
      ? await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
      : await prisma.tenant.findFirst({ where: { users: { some: { email } } } });

    if (!tenant || !tenant.isActive) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      include: { store: { select: { id: true, name: true, code: true } } },
    });

    if (!user || !user.isActive) throw new AppError('Credenciais inválidas', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Credenciais inválidas', 401);

    // Atualiza último login
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      storeId: user.storeId ?? undefined,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

    // Persiste refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        storeId: user.storeId,
        store: user.store,
        avatar: user.avatar,
      },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, logo: tenant.logo },
    };
  }

  async refreshToken(token: string) {
    const record = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } });
    if (!record || record.expiresAt < new Date()) {
      if (record) await prisma.refreshToken.delete({ where: { id: record.id } });
      throw new AppError('Refresh token inválido ou expirado', 401);
    }

    const user = record.user;
    if (!user.isActive) throw new AppError('Usuário desativado', 401);

    const payload: JwtPayload = {
      sub: user.id, tenantId: user.tenantId,
      role: user.role, storeId: user.storeId ?? undefined,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    return { accessToken };
  }

  async revokeToken(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        tenantId: true, storeId: true, avatar: true, phone: true,
        store: { select: { id: true, name: true, code: true } },
        tenant: { select: { id: true, name: true, slug: true, logo: true, plan: true } },
      },
    });
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return user;
  }
}
