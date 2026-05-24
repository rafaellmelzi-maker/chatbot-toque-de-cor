import { prisma } from '../config/database';
import { logger } from '../utils/logger';

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
   * Geração de embedding desabilitada (sem chave OpenAI válida).
   * Busca textual é usada em searchSimilarProducts.
   */
  async generateProductEmbedding(_productId: string, _tenantId: string): Promise<void> {
    logger.info('generateProductEmbedding: embeddings vetoriais desabilitados, usando busca textual');
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
