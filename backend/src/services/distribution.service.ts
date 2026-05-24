import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { WhatsAppService } from './whatsapp.service';
import type { User, Conversation, Customer, Store } from '@prisma/client';

const whatsappService = new WhatsAppService();

/** Tempo limite para resposta do vendedor antes de redistribuir (5 min) */
const ASSIGNMENT_TIMEOUT_MS = 5 * 60 * 1000;

type SellerSelectionParams = {
  tenantId: string;
  storeId: string;
  projectType?: string;
  priority: 'HIGH' | 'NORMAL';
};

type ConversationWithCustomer = Conversation & { customer: Customer | null };

// ─── SERVIÇO DE DISTRIBUIÇÃO AUTOMÁTICA DE LEADS ─────────────────────────────

export class DistributionService {
  // ──────────────────────────────────────────────────────────────────────────
  // ENTRADA PRINCIPAL: atribuir conversa ao melhor vendedor disponível
  // ──────────────────────────────────────────────────────────────────────────

  async assignConversation(conversationId: string, tenantId: string): Promise<boolean> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { customer: true },
    });

    if (!conversation) {
      logger.error(`[Distribution] Conversa não encontrada: ${conversationId}`);
      return false;
    }

    const sessionData = (conversation.sessionData as Record<string, unknown>) ?? {};
    const storeId = conversation.storeId;
    const area = sessionData.area as number | undefined;
    const surface = sessionData.surface as string | undefined;
    const priority: 'HIGH' | 'NORMAL' = area && area >= 500 ? 'HIGH' : 'NORMAL';

    if (!storeId) {
      logger.warn(`[Distribution] Conversa ${conversationId} sem loja associada — notificando supervisor`);
      await this.sendFallbackNotification(tenantId, null, conversationId, conversation);
      return false;
    }

    const seller = await this.selectSeller({ tenantId, storeId, projectType: surface, priority });

    if (!seller) {
      logger.warn(`[Distribution] Sem vendedor disponível na loja ${storeId} — notificando supervisor`);
      await this.sendFallbackNotification(tenantId, storeId, conversationId, conversation);
      return false;
    }

    // Contabiliza tentativa
    const lastLog = await prisma.assignmentLog.findFirst({
      where: { conversationId },
      orderBy: { assignedAt: 'desc' },
    });
    const attemptNumber = lastLog ? lastLog.attemptNumber + 1 : 1;

    // Registra log de atribuição
    await prisma.assignmentLog.create({
      data: {
        tenantId,
        conversationId,
        sellerId: seller.id,
        storeId,
        priority,
        projectType: surface,
        attemptNumber,
      },
    });

    // Atualiza conversa e contador do vendedor
    await Promise.all([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedUserId: seller.id },
      }),
      prisma.user.update({
        where: { id: seller.id },
        data: { totalLeadsReceived: { increment: 1 } },
      }),
    ]);

    // Recupera resumo gerado pela IA
    let summaryObj: Record<string, unknown> = {};
    if (conversation.summary) {
      try {
        summaryObj = JSON.parse(conversation.summary);
      } catch {
        summaryObj = { summary: conversation.summary };
      }
    }

    await this.notifySeller(seller, conversation, sessionData, summaryObj);

    logger.info(
      `[Distribution] Conversa ${conversationId} → vendedor "${seller.name}" (tentativa ${attemptNumber}, prioridade ${priority})`,
    );
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ALGORITMO WEIGHTED ROUND-ROBIN COM VALIDAÇÕES
  // ──────────────────────────────────────────────────────────────────────────

  private async selectSeller(params: SellerSelectionParams): Promise<User | null> {
    const { tenantId, storeId, projectType, priority } = params;
    const now = new Date();

    // 1. Buscar vendedores ativos e online na loja
    let sellers = await prisma.user.findMany({
      where: {
        tenantId,
        storeId,
        role: 'SELLER',
        isActive: true,
        isOnline: true,
        isPaused: false,
      },
    });

    // 2. Filtrar pausados temporariamente
    sellers = sellers.filter(s => !s.pausedUntil || s.pausedUntil <= now);

    // 3. Filtrar por horário de trabalho configurado
    sellers = sellers.filter(s =>
      this.isWithinWorkingHours(s.workingHours as WorkingHours | null, now),
    );

    if (sellers.length === 0) return null;

    // 4. Filtrar por capacidade (carga atual < máximo)
    const loadMap = new Map<string, number>();
    await Promise.all(
      sellers.map(async s => {
        const count = await prisma.conversation.count({
          where: { assignedUserId: s.id, status: { in: ['WAITING', 'HUMAN'] } },
        });
        loadMap.set(s.id, count);
      }),
    );
    sellers = sellers.filter(s => (loadMap.get(s.id) ?? 0) < s.maxConcurrent);

    if (sellers.length === 0) return null;

    // 5. Se prioridade ALTA → preferir vendedores sênior (weight >= 3 ou score >= 7)
    let candidates = sellers;
    if (priority === 'HIGH') {
      const senior = sellers.filter(s => s.sellerWeight >= 3 || s.performanceScore >= 7);
      if (senior.length > 0) candidates = senior;
    }

    // 6. Calcular peso efetivo por vendedor
    const scored = candidates.map(s => {
      const currentLoad = loadMap.get(s.id) ?? 0;
      const loadFactor = 1 - currentLoad / Math.max(s.maxConcurrent, 1);
      const specialtyBonus =
        projectType && s.sellerSpecialties.includes(projectType) ? 1.5 : 1.0;
      const effectiveWeight =
        s.sellerWeight * (s.performanceScore / 5.0) * loadFactor * specialtyBonus;
      return { seller: s, effectiveWeight };
    });

    // 7. Ordenar por peso efetivo; desempate por total de leads recebidos (menos = prioridade)
    scored.sort((a, b) => {
      const diff = b.effectiveWeight - a.effectiveWeight;
      if (Math.abs(diff) > 0.05) return diff;
      return a.seller.totalLeadsReceived - b.seller.totalLeadsReceived;
    });

    // 8. Dentro dos top candidatos (até 20% abaixo do top), round-robin por recebidos
    const topWeight = scored[0].effectiveWeight;
    const topGroup = scored.filter(s => s.effectiveWeight >= topWeight * 0.8);
    topGroup.sort((a, b) => a.seller.totalLeadsReceived - b.seller.totalLeadsReceived);

    return topGroup[0].seller;
  }

  private isWithinWorkingHours(wh: WorkingHours | null, now: Date): boolean {
    if (!wh) return true; // sem restrição = sempre disponível
    const { start, end, days } = wh;
    const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
    if (days && !days.includes(dayOfWeek)) return false;
    if (!start || !end) return true;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins >= sh * 60 + sm && nowMins <= eh * 60 + em;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // NOTIFICAÇÃO WHATSAPP AO VENDEDOR
  // ──────────────────────────────────────────────────────────────────────────

  private async notifySeller(
    seller: User,
    conversation: ConversationWithCustomer,
    sessionData: Record<string, unknown>,
    summary: Record<string, unknown>,
  ): Promise<void> {
    if (!seller.phone) {
      logger.warn(`[Distribution] Vendedor ${seller.id} sem telefone — não notificado`);
      return;
    }

    const store = conversation.storeId
      ? await prisma.store.findUnique({ where: { id: conversation.storeId } })
      : null;

    const storeName = store?.name?.replace(/^Toque de Cor[\s–-]+/i, '') || 'Principal';
    const customerName =
      (sessionData.customerName as string) ||
      conversation.customer?.name ||
      'Não informado';
    const customerPhone = conversation.whatsappPhone || 'Não informado';
    const area = sessionData.area as number | undefined;
    const surface = sessionData.surface as string | undefined;
    const environment = sessionData.environment as string | undefined;
    const priority = area && area >= 500 ? 'ALTA ⚡' : 'NORMAL';

    // Produtos recomendados (do resumo da IA)
    const products = (summary.products || summary.recommendedProducts) as
      | Array<{ name: string; quantity: number; unit?: string }>
      | undefined;
    let productLines = '';
    if (products?.length) {
      productLines =
        '\n🎨 *PRODUTOS RECOMENDADOS:*\n' +
        products.map(p => `• ${p.name} × ${p.quantity}${p.unit || ''}`).join('\n');
    }

    const summaryText =
      (summary.summary as string) ||
      (summary.briefDescription as string) ||
      (typeof summary === 'string' ? summary : 'Ver histórico da conversa');

    const lines = [
      `🔔 *NOVO LEAD — Toque de Cor ${storeName}*`,
      `────────────────────`,
      `👤 Cliente: ${customerName}`,
      `📱 Telefone: ${customerPhone}`,
      `⭐ Prioridade: ${priority}`,
      ``,
      `📋 *PROJETO:*`,
      environment ? `• Ambiente: ${environment}` : '',
      surface ? `• Superfície: ${surface}` : '',
      area ? `• Metragem: ${area} m²` : '',
      productLines,
      ``,
      `💬 *RESUMO:* ${summaryText}`,
      ``,
      `⏰ Responda em até *5 minutos* para garantir este lead.`,
    ]
      .filter(l => l !== '')
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    try {
      await whatsappService.sendMessage(conversation.tenantId, seller.phone, lines);
      logger.info(
        `[Distribution] Notificação enviada: vendedor "${seller.name}" (${seller.phone})`,
      );
    } catch (err) {
      logger.error(`[Distribution] Falha ao notificar vendedor ${seller.id}:`, err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FALLBACK: sem vendedor disponível → notificar supervisor/loja
  // ──────────────────────────────────────────────────────────────────────────

  private async sendFallbackNotification(
    tenantId: string,
    storeId: string | null,
    conversationId: string,
    conversation: ConversationWithCustomer,
  ): Promise<void> {
    let target: Store | null = null;
    if (storeId) {
      target = await prisma.store.findUnique({ where: { id: storeId } });
    }

    // Tenta supervisores STORE_MANAGER da loja
    const supervisors = storeId
      ? await prisma.user.findMany({
          where: { tenantId, storeId, role: 'STORE_MANAGER', isActive: true },
        })
      : [];

    const phones: string[] = [];
    if (target?.whatsapp) phones.push(target.whatsapp);
    else if (target?.phone) phones.push(target.phone);
    supervisors.forEach(s => s.phone && phones.push(s.phone));

    if (phones.length === 0) {
      logger.warn(`[Distribution] Fallback: sem contato de supervisor para loja ${storeId}`);
      return;
    }

    const customerPhone = conversation.whatsappPhone || 'desconhecido';
    const msg = [
      `🚨 *LEAD SEM VENDEDOR DISPONÍVEL*`,
      `────────────────────`,
      `Conversa: ${conversationId}`,
      `Cliente: ${customerPhone}`,
      ``,
      `Nenhum vendedor online/disponível no momento.`,
      `Acesse o painel para atribuir manualmente.`,
    ].join('\n');

    for (const phone of phones) {
      try {
        await whatsappService.sendMessage(tenantId, phone, msg);
      } catch (err) {
        logger.error(`[Distribution] Falha ao enviar fallback para ${phone}:`, err);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TIMEOUT + REDISTRIBUIÇÃO (chamado a cada 30s)
  // ──────────────────────────────────────────────────────────────────────────

  async redistributeTimedOut(): Promise<void> {
    const cutoff = new Date(Date.now() - ASSIGNMENT_TIMEOUT_MS);

    // Busca conversas WAITING com assignedUser e transferredAt antigo
    const stale = await prisma.conversation.findMany({
      where: {
        status: 'WAITING',
        assignedUserId: { not: null },
        transferredAt: { lt: cutoff },
      },
      include: { customer: true },
    });

    for (const conv of stale) {
      // Verifica se o último log ainda não tem resposta nem redistribuição
      const lastLog = await prisma.assignmentLog.findFirst({
        where: { conversationId: conv.id },
        orderBy: { assignedAt: 'desc' },
      });

      if (!lastLog || lastLog.respondedAt || lastLog.redistributedAt) continue;
      if (lastLog.assignedAt >= cutoff) continue; // ainda dentro do prazo

      logger.info(
        `[Distribution] Timeout: redistribuindo conversa ${conv.id} do vendedor ${lastLog.sellerId}`,
      );

      // Marca log atual como redistribuído
      await prisma.assignmentLog.update({
        where: { id: lastLog.id },
        data: {
          redistributedAt: new Date(),
          redistributionReason: 'TIMEOUT_5MIN',
        },
      });

      // Limpa atribuição e reinicia o timer
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { assignedUserId: null, transferredAt: new Date() },
      });

      // Re-atribui para próximo vendedor elegível
      await this.assignConversation(conv.id, conv.tenantId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGISTRAR RESPOSTA DO VENDEDOR
  // ──────────────────────────────────────────────────────────────────────────

  async markResponded(conversationId: string): Promise<void> {
    const log = await prisma.assignmentLog.findFirst({
      where: { conversationId, respondedAt: null, redistributedAt: null },
      orderBy: { assignedAt: 'desc' },
    });
    if (!log) return;

    const responseTimeSec = Math.floor((Date.now() - log.assignedAt.getTime()) / 1000);
    await prisma.assignmentLog.update({
      where: { id: log.id },
      data: { respondedAt: new Date(), responseTimeSec },
    });

    await this.updateAvgResponseTime(log.sellerId, responseTimeSec);
  }

  private async updateAvgResponseTime(sellerId: string, newTimeSec: number): Promise<void> {
    const seller = await prisma.user.findUnique({ where: { id: sellerId } });
    if (!seller) return;
    const current = seller.avgResponseTimeSec ?? newTimeSec;
    // Média móvel exponencial: 70% histórico + 30% novo
    const newAvg = Math.floor(current * 0.7 + newTimeSec * 0.3);
    await prisma.user.update({
      where: { id: sellerId },
      data: { avgResponseTimeSec: newAvg },
    });
    await this.updatePerformanceScore(sellerId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCORE DE PERFORMANCE
  // ──────────────────────────────────────────────────────────────────────────

  async updatePerformanceScore(sellerId: string): Promise<void> {
    const seller = await prisma.user.findUnique({ where: { id: sellerId } });
    if (!seller || seller.totalLeadsReceived === 0) return;

    const conversionRate = seller.totalLeadsConverted / seller.totalLeadsReceived; // 0-1
    const avgResp = seller.avgResponseTimeSec ?? 300; // default 5 min

    // Tempo de resposta: 0s=10pts, 300s=5pts, 600s+=1pt (escala linear)
    const respScore = Math.max(1, 10 - avgResp / 60);
    const convScore = conversionRate * 10;

    // Peso: 40% tempo, 60% conversão
    const raw = respScore * 0.4 + convScore * 0.6;
    const score = Math.min(10, Math.max(0, Math.round(raw * 10) / 10));

    await prisma.user.update({ where: { id: sellerId }, data: { performanceScore: score } });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ──────────────────────────────────────────────────────────────────────────

  async getDashboard(tenantId: string) {
    const now = Date.now();
    const todayStart = new Date(now - 86_400_000);

    const [sellers, conversations, logs] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId, role: 'SELLER', isActive: true },
        include: { store: { select: { name: true, city: true } } },
        orderBy: [{ isOnline: 'desc' }, { performanceScore: 'desc' }],
      }),
      prisma.conversation.findMany({
        where: { tenantId, status: { in: ['WAITING', 'HUMAN'] } },
        select: {
          id: true,
          storeId: true,
          assignedUserId: true,
          status: true,
          transferredAt: true,
        },
      }),
      prisma.assignmentLog.findMany({
        where: { tenantId },
        orderBy: { assignedAt: 'desc' },
        take: 500,
      }),
    ]);

    const sellerStats = sellers.map(s => {
      const active = conversations.filter(c => c.assignedUserId === s.id);
      const myLogs = logs.filter(l => l.sellerId === s.id);
      const redistributions = myLogs.filter(l => l.redistributedAt).length;
      const timedOutCount = active.filter(
        c => c.transferredAt && now - c.transferredAt.getTime() > ASSIGNMENT_TIMEOUT_MS,
      ).length;

      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        store: s.store?.name,
        storeCity: s.store?.city,
        role: s.role,
        isOnline: s.isOnline,
        isPaused: s.isPaused,
        pausedUntil: s.pausedUntil,
        weight: s.sellerWeight,
        specialties: s.sellerSpecialties,
        maxConcurrent: s.maxConcurrent,
        performanceScore: s.performanceScore,
        workingHours: s.workingHours,
        totalLeadsReceived: s.totalLeadsReceived,
        totalLeadsConverted: s.totalLeadsConverted,
        avgResponseTimeSec: s.avgResponseTimeSec,
        currentLoad: active.length,
        timedOutLeads: timedOutCount,
        redistributions,
        conversionRate:
          s.totalLeadsReceived > 0
            ? Math.round((s.totalLeadsConverted / s.totalLeadsReceived) * 100)
            : 0,
      };
    });

    // Fila por loja
    const queueByStore = conversations.reduce(
      (acc, c) => {
        const key = c.storeId ?? '_sem_loja';
        if (!acc[key]) acc[key] = { waiting: 0, inHuman: 0 };
        if (c.status === 'WAITING') acc[key].waiting++;
        else if (c.status === 'HUMAN') acc[key].inHuman++;
        return acc;
      },
      {} as Record<string, { waiting: number; inHuman: number }>,
    );

    return {
      totals: {
        onlineSellers: sellers.filter(s => s.isOnline && !s.isPaused).length,
        waitingLeads: conversations.filter(c => c.status === 'WAITING').length,
        activeLeads: conversations.filter(c => c.status === 'HUMAN').length,
        totalLeadsToday: logs.filter(l => l.assignedAt > todayStart).length,
      },
      sellers: sellerStats,
      queueByStore,
      recentLogs: logs.slice(0, 50),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REDISTRIBUIÇÃO MANUAL
  // ──────────────────────────────────────────────────────────────────────────

  async manualRedistribute(
    conversationId: string,
    tenantId: string,
    reason: string,
  ): Promise<boolean> {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, status: { in: ['WAITING', 'HUMAN'] } },
    });
    if (!conv) return false;

    const lastLog = await prisma.assignmentLog.findFirst({
      where: { conversationId, redistributedAt: null },
      orderBy: { assignedAt: 'desc' },
    });

    if (lastLog) {
      await prisma.assignmentLog.update({
        where: { id: lastLog.id },
        data: { redistributedAt: new Date(), redistributionReason: reason },
      });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedUserId: null, transferredAt: new Date() },
    });

    return this.assignConversation(conversationId, tenantId);
  }
}

// ─── TIPO AUXILIAR ────────────────────────────────────────────────────────────
type WorkingHours = {
  start?: string;
  end?: string;
  days?: number[];
};
