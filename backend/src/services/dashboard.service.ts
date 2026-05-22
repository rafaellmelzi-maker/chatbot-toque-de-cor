import { prisma } from '../config/database';

function periodToDate(period: string): Date {
  const n = parseInt(period);
  const d = new Date();
  if (period.endsWith('d')) d.setDate(d.getDate() - n);
  else if (period.endsWith('m')) d.setMonth(d.getMonth() - n);
  else d.setDate(d.getDate() - 30);
  return d;
}

export class DashboardService {
  async getStats(tenantId: string, period: string) {
    const since = periodToDate(period);

    const [
      totalConversations, activeConversations, totalLeads, wonLeads,
      totalMessages, avgScore,
    ] = await Promise.all([
      prisma.conversation.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { tenantId, status: { in: ['BOT', 'WAITING', 'HUMAN'] } } }),
      prisma.lead.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.lead.count({ where: { tenantId, status: 'WON', createdAt: { gte: since } } }),
      prisma.message.count({ where: { conversation: { tenantId }, createdAt: { gte: since } } }),
      prisma.conversation.aggregate({ _avg: { qualificationScore: true }, where: { tenantId, createdAt: { gte: since } } }),
    ]);

    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';
    const avgQualification = avgScore._avg.qualificationScore?.toFixed(0) ?? '0';

    return {
      totalConversations,
      activeConversations,
      totalLeads,
      wonLeads,
      totalMessages,
      conversionRate: `${conversionRate}%`,
      avgQualificationScore: Number(avgQualification),
      period,
    };
  }

  async getConversationsChart(tenantId: string, period: string) {
    const since = periodToDate(period);

    const conversations = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT
        DATE("createdAt")::text AS date,
        COUNT(*)::bigint AS count
      FROM conversations
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt")
    `;

    return conversations.map((c) => ({ date: c.date, count: Number(c.count) }));
  }

  async getTopProducts(tenantId: string) {
    const results = await prisma.conversationProduct.groupBy({
      by: ['productId'],
      _count: { productId: true },
      where: { conversation: { tenantId } },
      orderBy: { _count: { productId: 'desc' } },
      take: 10,
    });

    const productIds = results.map((r) => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: { select: { name: true } } },
    });

    return results.map((r) => {
      const product = products.find((p) => p.id === r.productId);
      return { productId: r.productId, name: product?.name ?? 'N/A', category: product?.category?.name ?? 'N/A', count: r._count.productId };
    });
  }

  async getLeadsFunnel(tenantId: string) {
    const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
    const counts = await prisma.lead.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { tenantId },
    });

    return statuses.map((status) => ({
      status,
      count: counts.find((c) => c.status === status)?._count.status ?? 0,
    }));
  }

  async getStorePerformance(tenantId: string) {
    const stores = await prisma.store.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: { select: { conversations: true, leads: true } },
        leads: { where: { status: 'WON' }, select: { estimatedValue: true } },
      },
    });

    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      conversations: s._count.conversations,
      leads: s._count.leads,
      wonLeads: s.leads.length,
      revenue: s.leads.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0),
    }));
  }
}
