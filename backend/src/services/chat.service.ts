import { prisma } from '../config/database';
import { AIService } from './ai.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ChannelType } from '@prisma/client';

const aiService = new AIService();

interface StartConversationParams {
  tenantId: string;
  channel: 'WHATSAPP' | 'WEBCHAT';
  customerPhone?: string;
  customerName?: string;
  storeId?: string;
}

export class ChatService {
  async startConversation(params: StartConversationParams) {
    const { tenantId, channel, customerPhone, customerName, storeId } = params;

    // Encontra ou cria cliente
    let customerId: string | undefined;
    if (customerPhone) {
      let customer = await prisma.customer.findUnique({
        where: { tenantId_phone: { tenantId, phone: customerPhone } },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: { tenantId, phone: customerPhone, name: customerName },
        });
      } else if (customerName && !customer.name) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { name: customerName },
        });
      }
      customerId = customer.id;
    }

    // Cria conversa
    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        channel: channel as ChannelType,
        customerId,
        storeId,
        whatsappPhone: customerPhone,
        source: channel.toLowerCase(),
      },
    });

    // Busca mensagem de boas-vindas
    const aiConfig = await prisma.aIConfig.findUnique({ where: { tenantId } });
    const welcomeMessage = aiConfig?.welcomeMessage ?? 'Olá! 👋 Como posso te ajudar hoje?';

    // Salva mensagem de boas-vindas
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: welcomeMessage,
        isFromBot: true,
      },
    });

    logger.info(`Nova conversa iniciada: ${conversation.id} [${channel}]`);

    return {
      conversationId: conversation.id,
      welcomeMessage,
    };
  }

  async processMessage(conversationId: string, userMessage: string, tenantId: string) {
    // Busca conversa
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) throw new AppError('Conversa não encontrada', 404);

    // Se está com vendedor humano, não processa pela IA
    if (conversation.status === 'HUMAN') {
      throw new AppError('Esta conversa está em atendimento humano', 400);
    }

    // Salva mensagem do usuário
    await prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: userMessage,
        isFromBot: false,
      },
    });

    // Processa com IA
    const sessionData = (conversation.sessionData as Record<string, unknown>) ?? {};
    const aiResult = await aiService.processMessage(
      conversationId,
      userMessage,
      tenantId,
      sessionData as Parameters<typeof aiService.processMessage>[3],
    );

    // Atualiza dados da sessão
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        sessionData: aiResult.updatedSessionData as object,
        qualificationScore: aiResult.intent.purchaseScore,
      },
    });

    // Salva resposta da IA
    const botMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: aiResult.response,
        isFromBot: true,
        tokensUsed: aiResult.tokensUsed,
      },
    });

    // Se deve transferir para humano
    if (aiResult.shouldTransfer) {
      await this.initiateTransfer(conversationId, tenantId, aiResult.updatedSessionData);
    }

    // Captura lead se score alto
    if (aiResult.intent.purchaseScore >= 50) {
      await this.upsertLead(conversationId, tenantId, aiResult.updatedSessionData, aiResult.intent.purchaseScore);
    }

    return {
      messageId: botMessage.id,
      response: aiResult.response,
      shouldTransfer: aiResult.shouldTransfer,
      sessionData: aiResult.updatedSessionData,
    };
  }

  async getConversationHistory(conversationId: string, tenantId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 100 },
        customer: true,
        recommendedProducts: { include: { product: true } },
      },
    });

    if (!conversation) throw new AppError('Conversa não encontrada', 404);
    return conversation;
  }

  private async initiateTransfer(conversationId: string, tenantId: string, sessionData: object) {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.status !== 'BOT') return;

    // Gera resumo para o vendedor
    const summary = await aiService.generateConversationSummary(conversationId, sessionData as Parameters<typeof aiService.generateConversationSummary>[1], []);

    // Atualiza status para WAITING
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'WAITING',
        transferredAt: new Date(),
        summary: JSON.stringify(summary),
      },
    });

    // Cria mensagem de transferência
    const aiConfig = await prisma.aIConfig.findUnique({ where: { tenantId } });
    const transferMsg = aiConfig?.transferMessage ?? '✅ Conectando você com um consultor especializado!';

    await prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: transferMsg,
        isFromBot: true,
      },
    });

    logger.info(`Conversa ${conversationId} transferida para humano`);
  }

  private async upsertLead(
    conversationId: string,
    tenantId: string,
    sessionData: Record<string, unknown>,
    score: number,
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { customer: true },
    });
    if (!conversation) return;

    const existingLead = await prisma.lead.findFirst({ where: { conversationId } });
    if (existingLead) return;

    await prisma.lead.create({
      data: {
        tenantId,
        conversationId,
        customerId: conversation.customerId ?? undefined,
        storeId: conversation.storeId ?? undefined,
        phone: conversation.customer?.phone ?? conversation.whatsappPhone ?? '',
        name: conversation.customer?.name ?? (sessionData.customerName as string) ?? undefined,
        surface: sessionData.surface as string ?? undefined,
        environment: sessionData.environment as string ?? undefined,
        area: sessionData.area as number ?? undefined,
        budget: sessionData.budget as number ?? undefined,
        estimatedValue: score > 70 ? (sessionData.budget as number ?? undefined) : undefined,
        source: conversation.channel,
      },
    });
  }
}
