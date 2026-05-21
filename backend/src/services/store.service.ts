import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { WhatsAppService } from './whatsapp.service';

const whatsappService = new WhatsAppService();

export class StoreService {
  async list(tenantId: string) {
    return prisma.store.findMany({
      where: { tenantId, isActive: true },
      include: { whatsappInstances: { select: { status: true, phone: true } }, _count: { select: { conversations: true, leads: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string, tenantId: string) {
    const store = await prisma.store.findFirst({
      where: { id, tenantId },
      include: { whatsappInstances: true, users: { select: { id: true, name: true, role: true }, where: { isActive: true } } },
    });
    if (!store) throw new AppError('Loja não encontrada', 404);
    return store;
  }

  async create(tenantId: string, data: object) {
    return prisma.store.create({ data: { tenantId, ...(data as any) } });
  }

  async update(id: string, tenantId: string, data: object) {
    const store = await prisma.store.findFirst({ where: { id, tenantId } });
    if (!store) throw new AppError('Loja não encontrada', 404);
    return prisma.store.update({ where: { id }, data });
  }

  async connectWhatsApp(id: string, tenantId: string) {
    return whatsappService.createInstance(id, tenantId);
  }

  async getQRCode(id: string, tenantId: string) {
    const store = await prisma.store.findFirst({ where: { id, tenantId } });
    if (!store) throw new AppError('Loja não encontrada', 404);
    return whatsappService.getQRCode(id);
  }
}
