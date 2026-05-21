import { openai, OPENAI_CONFIG } from '../config/openai';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface EmbeddingResult {
  productId: string;
  score: number;
  product: {
    id: string;
    name: string;
    description: string | null;
    surfaces: string[];
    environments: string[];
    finishes: string[];
    coverage: number | null;
    price: number;
    technicalData: string | null;
    tags: string[];
  };
}

export class RAGService {
  /**
   * Gera embedding para um produto e salva no banco
   */
  async generateProductEmbedding(productId: string, tenantId: string): Promise<void> {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { category: true, brand: true },
    });

    if (!product) throw new AppError('Produto não encontrado', 404);

    // Texto rico para gerar embedding semanticamente relevante
    const text = [
      `Nome: ${product.name}`,
      `Marca: ${product.brand.name}`,
      `Categoria: ${product.category.name}`,
      `Descrição: ${product.description ?? ''}`,
      `Superfícies: ${product.surfaces.join(', ')}`,
      `Ambientes: ${product.environments.join(', ')}`,
      `Acabamentos: ${product.finishes.join(', ')}`,
      `Rendimento: ${product.coverage ?? 'N/A'} m²/L`,
      `Tags: ${product.tags.join(', ')}`,
      `Dados técnicos: ${product.technicalData ?? ''}`,
      `Aplicação: ${product.application ?? ''}`,
    ].join('. ');

    const response = await openai.embeddings.create({
      model: OPENAI_CONFIG.embeddingModel,
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Salva o embedding como vetor no PostgreSQL (pgvector)
    await prisma.$executeRaw`
      UPDATE products
      SET embedding = ${JSON.stringify(embedding)}::vector
      WHERE id = ${productId}
    `;

    logger.info(`Embedding gerado para produto ${product.name}`);
  }

  /**
   * Busca produtos semanticamente similares à query do cliente
   */
  async searchSimilarProducts(
    tenantId: string,
    query: string,
    limit = 5,
  ): Promise<EmbeddingResult[]> {
    try {
      // Gera embedding da query do usuário
      const queryEmbedding = await openai.embeddings.create({
        model: OPENAI_CONFIG.embeddingModel,
        input: query,
      });

      const vector = JSON.stringify(queryEmbedding.data[0].embedding);

      // Busca por similaridade coseno com pgvector
      const results = await prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          surfaces: string[];
          environments: string[];
          finishes: string[];
          coverage: number | null;
          price: number;
          technical_data: string | null;
          tags: string[];
          score: number;
        }>
      >`
        SELECT
          p.id,
          p.name,
          p.description,
          p.surfaces,
          p.environments,
          p.finishes,
          p.coverage,
          p.price,
          p.technical_data,
          p.tags,
          1 - (p.embedding <=> ${vector}::vector) AS score
        FROM products p
        WHERE
          p.tenant_id = ${tenantId}
          AND p.is_active = true
          AND p.embedding IS NOT NULL
        ORDER BY p.embedding <=> ${vector}::vector
        LIMIT ${limit}
      `;

      return results.map((r) => ({
        productId: r.id,
        score: r.score,
        product: {
          id: r.id,
          name: r.name,
          description: r.description,
          surfaces: r.surfaces,
          environments: r.environments,
          finishes: r.finishes,
          coverage: r.coverage,
          price: r.price,
          technicalData: r.technical_data,
          tags: r.tags,
        },
      }));
    } catch (err) {
      logger.error('Erro na busca RAG:', err);
      // Fallback: busca textual simples
      return this.textFallbackSearch(tenantId, query, limit);
    }
  }

  /**
   * Fallback se o RAG falhar – busca textual com ILIKE
   */
  private async textFallbackSearch(
    tenantId: string,
    query: string,
    limit: number,
  ): Promise<EmbeddingResult[]> {
    const keywords = query.toLowerCase().split(' ').filter((w) => w.length > 2);
    if (!keywords.length) return [];

    const products = await prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { contains: keywords[0], mode: 'insensitive' } },
          { description: { contains: keywords[0], mode: 'insensitive' } },
          { tags: { has: keywords[0] } },
          { surfaces: { has: keywords[0] } },
        ],
      },
      take: limit,
    });

    return products.map((p) => ({
      productId: p.id,
      score: 0.7,
      product: {
        id: p.id,
        name: p.name,
        description: p.description,
        surfaces: p.surfaces,
        environments: p.environments,
        finishes: p.finishes,
        coverage: p.coverage,
        price: p.price,
        technicalData: p.technicalData,
        tags: p.tags,
      },
    }));
  }

  /**
   * Formata produtos para incluir no prompt do sistema
   */
  formatProductsForPrompt(products: EmbeddingResult[]): string {
    if (!products.length) return 'Nenhum produto específico identificado para esta consulta.';

    return products
      .map(
        ({ product }, i) =>
          `[Produto ${i + 1}]
Nome: ${product.name}
Superfícies: ${product.surfaces.join(', ')}
Ambientes: ${product.environments.join(', ')}
Acabamentos: ${product.finishes.join(', ')}
Rendimento: ${product.coverage ?? 'N/A'} m²/L
Preço: R$ ${product.price.toFixed(2)}
Dados técnicos: ${product.technicalData ?? 'N/A'}`,
      )
      .join('\n\n');
  }
}
