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
   * Usa busca textual inteligente (embeddings vetoriais não disponíveis)
   */
  async searchSimilarProducts(
    tenantId: string,
    query: string,
    limit = 5,
  ): Promise<EmbeddingResult[]> {
    try {

      return this.textFallbackSearch(tenantId, query, limit);
    } catch (err) {
      logger.error('Erro na busca RAG:', err);
      return [];
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
    const stopWords = new Set(['para', 'com', 'que', 'uma', 'por', 'mais', 'como', 'mas', 'foi', 'ele', 'ela', 'dos', 'das', 'nos', 'nas']);
    const keywords = query
      .toLowerCase()
      .replace(/[^a-záéíóúãõâêîôûàèìòùç\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    if (!keywords.length) {
      // Sem keywords: retorna os N produtos mais recentes
      const all = await prisma.product.findMany({ where: { tenantId, isActive: true }, take: limit });
      return all.map((p) => this.toResult(p, 0.3));
    }

    // Busca em múltiplos campos para cada keyword
    const orClauses = keywords.flatMap((kw) => [
      { name: { contains: kw, mode: 'insensitive' as const } },
      { description: { contains: kw, mode: 'insensitive' as const } },
      { tags: { has: kw } },
      { surfaces: { has: kw } },
      { environments: { has: kw } },
      { finishes: { has: kw } },
      { application: { contains: kw, mode: 'insensitive' as const } },
    ]);

    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true, OR: orClauses },
      take: limit * 3, // busca mais para re-rankar
      include: { brand: true, category: true },
    });

    // Pontua por número de campos que batem
    const scored = products.map((p) => {
      let score = 0;
      const text = `${p.name} ${p.description ?? ''} ${p.tags.join(' ')} ${p.surfaces.join(' ')} ${p.environments.join(' ')} ${p.finishes.join(' ')} ${p.application ?? ''}`.toLowerCase();
      for (const kw of keywords) {
        if (p.name.toLowerCase().includes(kw)) score += 3;
        else if (text.includes(kw)) score += 1;
      }
      return { p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ p, score }) =>
      this.toResult(p, Math.min(0.5 + score * 0.05, 0.95))
    );
  }

  private toResult(p: { id: string; name: string; description: string | null; surfaces: string[]; environments: string[]; finishes: string[]; coverage: number | null; price: number; technicalData: string | null; tags: string[] }, score: number): EmbeddingResult {
    return {
      productId: p.id,
      score,
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
    };
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
