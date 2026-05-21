import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class LeadService {
  async list(tenantId: string, params: { page: number; limit: number; status?: string; storeId?: string }) {
    const { page, limit, status, storeId } = params;
    const skip = (page - 1) * limit;
    const where = { tenantId, ...(status && { status: status as 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST' }), ...(storeId && { storeId }) };

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where, skip, take: limit,
        include: { store: { select: { name: true, code: true } }, customer: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, tenantId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, tenantId },
      include: { conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } }, customer: true, store: true },
    });
    if (!lead) throw new AppError('Lead não encontrado', 404);
    return lead;
  }

  async update(id: string, tenantId: string, data: object) {
    const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new AppError('Lead não encontrado', 404);
    return prisma.lead.update({ where: { id }, data });
  }

  async updateStatus(id: string, tenantId: string, status: string) {
    return this.update(id, tenantId, {
      status: status as 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST',
      ...(status === 'WON' || status === 'LOST' ? { closedAt: new Date() } : {}),
    });
  }
}
