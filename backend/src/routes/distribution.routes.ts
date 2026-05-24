import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import { DistributionService } from '../services/distribution.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const distributionService = new DistributionService();

// Todos os endpoints requerem autenticação
router.use(authenticate);

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

/**
 * GET /api/distribution/dashboard
 * Dashboard completo: vendedores, fila, logs, totais
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId as string;
    const data = await distributionService.getDashboard(tenantId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── SELLERS ─────────────────────────────────────────────────────────────────

/**
 * GET /api/distribution/sellers
 * Lista vendedores com status de disponibilidade
 */
router.get('/sellers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, storeId: authStoreId, role } = (req as any).user;
    const { storeId: queryStoreId } = req.query;

    // Gerentes só veem sua loja; admins podem filtrar
    const storeFilter =
      role === 'STORE_MANAGER'
        ? authStoreId
        : (queryStoreId as string) || undefined;

    const sellers = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['SELLER', 'STORE_MANAGER'] },
        isActive: true,
        ...(storeFilter ? { storeId: storeFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        storeId: true,
        isOnline: true,
        isPaused: true,
        pausedUntil: true,
        sellerWeight: true,
        sellerSpecialties: true,
        maxConcurrent: true,
        performanceScore: true,
        workingHours: true,
        totalLeadsReceived: true,
        totalLeadsConverted: true,
        avgResponseTimeSec: true,
        store: { select: { name: true, city: true } },
      },
      orderBy: [{ isOnline: 'desc' }, { performanceScore: 'desc' }],
    });

    // Adiciona carga atual
    const withLoad = await Promise.all(
      sellers.map(async s => {
        const currentLoad = await prisma.conversation.count({
          where: { assignedUserId: s.id, status: { in: ['WAITING', 'HUMAN'] } },
        });
        return { ...s, currentLoad };
      }),
    );

    res.json({ success: true, data: withLoad });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/distribution/sellers/:id
 * Atualiza configurações do vendedor (peso, especialidades, jornada, max)
 */
router.patch(
  '/sellers/:id',
  authorize('TENANT_ADMIN', 'STORE_MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as any).user;
      const { id } = req.params;
      const {
        sellerWeight,
        sellerSpecialties,
        maxConcurrent,
        workingHours,
        isActive,
        phone,
      } = req.body;

      const seller = await prisma.user.findFirst({ where: { id, tenantId } });
      if (!seller) throw new AppError('Vendedor não encontrado', 404);

      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(sellerWeight !== undefined && { sellerWeight: Number(sellerWeight) }),
          ...(sellerSpecialties !== undefined && { sellerSpecialties }),
          ...(maxConcurrent !== undefined && { maxConcurrent: Number(maxConcurrent) }),
          ...(workingHours !== undefined && { workingHours }),
          ...(isActive !== undefined && { isActive }),
          ...(phone !== undefined && { phone }),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          isOnline: true,
          isPaused: true,
          sellerWeight: true,
          sellerSpecialties: true,
          maxConcurrent: true,
          performanceScore: true,
          workingHours: true,
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/distribution/sellers/:id/online
 * Marcar vendedor como online
 */
router.post('/sellers/:id/online', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, id: authUserId, role } = (req as any).user;
    const { id } = req.params;

    // Vendedor só pode alterar o próprio status; admin pode alterar qualquer um
    if (role === 'SELLER' && id !== authUserId) {
      throw new AppError('Não autorizado', 403);
    }

    const seller = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!seller) throw new AppError('Vendedor não encontrado', 404);

    await prisma.user.update({
      where: { id },
      data: { isOnline: true, isPaused: false, pausedUntil: null },
    });

    res.json({ success: true, message: 'Vendedor marcado como online' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/distribution/sellers/:id/offline
 * Marcar vendedor como offline
 */
router.post('/sellers/:id/offline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, id: authUserId, role } = (req as any).user;
    const { id } = req.params;

    if (role === 'SELLER' && id !== authUserId) {
      throw new AppError('Não autorizado', 403);
    }

    const seller = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!seller) throw new AppError('Vendedor não encontrado', 404);

    await prisma.user.update({
      where: { id },
      data: { isOnline: false, isPaused: false },
    });

    res.json({ success: true, message: 'Vendedor marcado como offline' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/distribution/sellers/:id/pause
 * Pausar vendedor temporariamente (ex: em reunião)
 * Body: { minutes: number }
 */
router.post('/sellers/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, id: authUserId, role } = (req as any).user;
    const { id } = req.params;
    const { minutes = 30 } = req.body;

    if (role === 'SELLER' && id !== authUserId) {
      throw new AppError('Não autorizado', 403);
    }

    const seller = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!seller) throw new AppError('Vendedor não encontrado', 404);

    const pausedUntil = new Date(Date.now() + Number(minutes) * 60 * 1000);
    await prisma.user.update({
      where: { id },
      data: { isPaused: true, pausedUntil },
    });

    res.json({
      success: true,
      message: `Vendedor pausado por ${minutes} minutos`,
      pausedUntil,
    });
  } catch (err) {
    next(err);
  }
});

// ─── FILA ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/distribution/queue
 * Conversas aguardando/em atendimento humano, com info de atraso
 */
router.get('/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, storeId: authStoreId, role } = (req as any).user;
    const { storeId: queryStoreId } = req.query;

    const storeFilter =
      role === 'STORE_MANAGER' ? authStoreId : (queryStoreId as string) || undefined;

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        status: { in: ['WAITING', 'HUMAN'] },
        ...(storeFilter ? { storeId: storeFilter } : {}),
      },
      include: {
        customer: { select: { name: true, phone: true } },
        assignedUser: { select: { id: true, name: true } },
        store: { select: { name: true } },
      },
      orderBy: { transferredAt: 'asc' },
    });

    const now = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000;

    const data = conversations.map(c => ({
      id: c.id,
      status: c.status,
      store: c.store?.name,
      customer: c.customer?.name || c.whatsappPhone,
      phone: c.whatsappPhone,
      assignedTo: c.assignedUser?.name,
      assignedUserId: c.assignedUserId,
      transferredAt: c.transferredAt,
      waitingSeconds: c.transferredAt
        ? Math.floor((now - c.transferredAt.getTime()) / 1000)
        : null,
      isTimedOut: c.transferredAt
        ? now - c.transferredAt.getTime() > TIMEOUT_MS
        : false,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── REDISTRIBUIÇÃO ──────────────────────────────────────────────────────────

/**
 * POST /api/distribution/redistribute/:conversationId
 * Redistribuição manual de uma conversa
 */
router.post(
  '/redistribute/:conversationId',
  authorize('TENANT_ADMIN', 'STORE_MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as any).user;
      const { conversationId } = req.params;
      const { reason = 'MANUAL_ADMIN' } = req.body;

      const ok = await distributionService.manualRedistribute(
        conversationId,
        tenantId,
        reason,
      );

      if (!ok) throw new AppError('Conversa não encontrada ou não pode ser redistribuída', 400);

      res.json({ success: true, message: 'Conversa redistribuída com sucesso' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/distribution/trigger/:conversationId
 * Dispara distribuição manual (útil para testes ou atribuição atrasada)
 */
router.post(
  '/trigger/:conversationId',
  authorize('TENANT_ADMIN', 'STORE_MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as any).user;
      const { conversationId } = req.params;

      const ok = await distributionService.assignConversation(conversationId, tenantId);

      if (!ok) {
        res.json({ success: false, message: 'Sem vendedor disponível — notificação enviada ao supervisor' });
      } else {
        res.json({ success: true, message: 'Lead distribuído com sucesso' });
      }
    } catch (err) {
      next(err);
    }
  },
);

// ─── LOGS ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/distribution/logs
 * Histórico de atribuições
 */
router.get(
  '/logs',
  authorize('TENANT_ADMIN', 'STORE_MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as any).user;
      const { sellerId, page = '1', limit = '50' } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const [logs, total] = await Promise.all([
        prisma.assignmentLog.findMany({
          where: {
            tenantId,
            ...(sellerId ? { sellerId: sellerId as string } : {}),
          },
          orderBy: { assignedAt: 'desc' },
          skip,
          take: Number(limit),
          include: {
            seller: { select: { name: true, phone: true } },
          },
        }),
        prisma.assignmentLog.count({
          where: {
            tenantId,
            ...(sellerId ? { sellerId: sellerId as string } : {}),
          },
        }),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
