import { prisma } from '../config/database';
import { openai, OPENAI_CONFIG } from '../config/openai';
import { RAGService } from './rag.service';
import { AppError } from '../middleware/errorHandler';

const ragService = new RAGService();

export class ProductService {
  async list(tenantId: string, params: { page: number; limit: number; categoryId?: string; brandId?: string; search?: string }) {
    const { page, limit, categoryId, brandId, search } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      isActive: true,
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true, brand: true, images: { where: { isPrimary: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async semanticSearch(tenantId: string, query: string) {
    return ragService.searchSimilarProducts(tenantId, query);
  }

  async getById(id: string, tenantId: string) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: true, brand: true, images: true },
    });
    if (!product) throw new AppError('Produto não encontrado', 404);
    return product;
  }

  async create(tenantId: string, data: object) {
    const product = await prisma.product.create({
      data: { tenantId, ...(data as any) },
      include: { category: true, brand: true },
    });

    // Gera embedding automaticamente
    await ragService.generateProductEmbedding(product.id, tenantId).catch(() => {});

    return product;
  }

  async update(id: string, tenantId: string, data: object) {
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new AppError('Produto não encontrado', 404);

    const updated = await prisma.product.update({
      where: { id },
      data: data as any,
      include: { category: true, brand: true },
    });

    // Regenera embedding
    await ragService.generateProductEmbedding(id, tenantId).catch(() => {});

    return updated;
  }

  async remove(id: string, tenantId: string) {
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new AppError('Produto não encontrado', 404);
    await prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async generateEmbedding(id: string, tenantId: string) {
    return ragService.generateProductEmbedding(id, tenantId);
  }
}
