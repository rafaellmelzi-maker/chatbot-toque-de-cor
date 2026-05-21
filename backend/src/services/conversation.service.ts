import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { WhatsAppService } from './whatsapp.service';

const whatsappService = new WhatsAppService();

export class ConversationService {
  async list(tenantId: string, params: { page: number; limit: number; status?: string; storeId?: string; userId?: string }) {
    const { page, limit, status, storeId, userId } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status: status as any }),
      ...(storeId && { storeId }),
      ...(userId && { assignedUserId: userId }),
    };

    const [data, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          store: { select: { name: true, code: true } },
          assignedUser: { select: { name: true, email: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.conversation.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, tenantId: string) {
    const conv = await prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        store: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        recommendedProducts: { include: { product: { include: { brand: true } } } },
        leads: true,
      },
    });
    if (!conv) throw new AppError('Conversa não encontrada', 404);
    return conv;
  }

  async transferToHuman(id: string, tenantId: string, sellerId: string) {
    const conv = await prisma.conversation.findFirst({ where: { id, tenantId } });
    if (!conv) throw new AppError('Conversa não encontrada', 404);

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        status: 'HUMAN',
        assignedUserId: sellerId,
        transferredAt: conv.transferredAt ?? new Date(),
      },
    });

    return updated;
  }

  async resolve(id: string, tenantId: string) {
    const conv = await prisma.conversation.findFirst({ where: { id, tenantId } });
    if (!conv) throw new AppError('Conversa não encontrada', 404);

    return prisma.conversation.update({
      where: { id },
      data: { status: 'RESOLVED', closedAt: new Date() },
    });
  }

  async sendHumanMessage(id: string, tenantId: string, userId: string, message: string) {
    const conv = await prisma.conversation.findFirst({ where: { id, tenantId } });
    if (!conv) throw new AppError('Conversa não encontrada', 404);
    if (conv.status === 'BOT') throw new AppError('Esta conversa está no modo bot', 400);

    const msg = await prisma.message.create({
      data: { conversationId: id, userId, role: 'SELLER', content: message, isFromBot: false },
    });

    // Envia via WhatsApp se for canal WhatsApp
    if (conv.channel === 'WHATSAPP' && conv.whatsappPhone && conv.storeId) {
      await whatsappService.sendMessage(conv.storeId, conv.whatsappPhone, message).catch(() => {});
    }

    return msg;
  }
}
