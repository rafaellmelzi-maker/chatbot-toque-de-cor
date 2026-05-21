import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import bcrypt from 'bcryptjs';

export class UserService {
  async list(tenantId: string, storeId?: string) {
    return prisma.user.findMany({
      where: { tenantId, ...(storeId && { storeId }), isActive: true },
      select: { id: true, name: true, email: true, role: true, storeId: true, phone: true, avatar: true, lastLoginAt: true, store: { select: { name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, email: true, role: true, storeId: true, phone: true, avatar: true, lastLoginAt: true, store: { select: { name: true } } },
    });
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return user;
  }

  async create(tenantId: string, data: { name: string; email: string; password: string; role: string; storeId?: string; phone?: string }) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      data: { tenantId, name: data.name, email: data.email, passwordHash, role: data.role as 'TENANT_ADMIN' | 'STORE_MANAGER' | 'SELLER', storeId: data.storeId, phone: data.phone },
      select: { id: true, name: true, email: true, role: true, storeId: true },
    });
  }

  async update(id: string, tenantId: string, data: object) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true } });
  }

  async remove(id: string, tenantId: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new AppError('Usuário não encontrado', 404);
    await prisma.user.update({ where: { id }, data: { isActive: false } });
  }
}
