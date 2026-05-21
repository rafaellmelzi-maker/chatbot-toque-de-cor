// ─────────────────────────────────────────────────────────────────
// CALCULADORA DE TINTA – Toque de Cor
// ─────────────────────────────────────────────────────────────────

export interface PaintCalculationInput {
  area: number;           // m²
  coats?: number;         // número de demãos (padrão: 2)
  coverage: number;       // rendimento em m²/L por demão
  wasteFactor?: number;   // fator de desperdício (padrão: 0.10 = 10%)
}

export interface PaintCalculationResult {
  litersNeeded: number;
  litersWithWaste: number;
  recommendedPackages: PackageRecommendation[];
}

export interface PackageRecommendation {
  size: string;
  quantity: number;
  totalLiters: number;
  wastePercent: number;
}

// Embalagens padrão do mercado em litros
const STANDARD_SIZES = [0.9, 3.6, 18, 36];

export function calculatePaint(input: PaintCalculationInput): PaintCalculationResult {
  const { area, coats = 2, coverage, wasteFactor = 0.10 } = input;

  // Litros base necessários
  const litersNeeded = (area * coats) / coverage;

  // Com margem de desperdício
  const litersWithWaste = litersNeeded * (1 + wasteFactor);

  // Encontra a combinação mais eficiente de embalagens
  const recommendedPackages = findOptimalPackages(litersWithWaste);

  return {
    litersNeeded: roundTo2(litersNeeded),
    litersWithWaste: roundTo2(litersWithWaste),
    recommendedPackages,
  };
}

function findOptimalPackages(liters: number): PackageRecommendation[] {
  const results: PackageRecommendation[] = [];

  for (const size of STANDARD_SIZES) {
    const quantity = Math.ceil(liters / size);
    const totalLiters = quantity * size;
    const wastePercent = ((totalLiters - liters) / totalLiters) * 100;

    results.push({
      size: formatSize(size),
      quantity,
      totalLiters: roundTo2(totalLiters),
      wastePercent: roundTo2(wastePercent),
    });
  }

  // Ordena pela menor sobra percentual (mais eficiente)
  return results.sort((a, b) => a.wastePercent - b.wastePercent).slice(0, 3);
}

function formatSize(liters: number): string {
  if (liters < 1) return `${liters * 1000}mL`;
  return `${liters}L`;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula área de paredes de um ambiente retangular
 * Desconta portas (1.8m × 0.8m) e janelas (1.2m × 1.0m) automaticamente
 */
export function calculateRoomArea(params: {
  width: number;    // largura em m
  length: number;   // comprimento em m
  height?: number;  // pé direito em m (padrão 2.7)
  doors?: number;   // número de portas
  windows?: number; // número de janelas
  includeCeiling?: boolean;
}): number {
  const { width, length, height = 2.7, doors = 1, windows = 1, includeCeiling = false } = params;

  // Área total das 4 paredes
  const wallArea = 2 * (width + length) * height;

  // Desconta aberturas
  const doorArea = doors * (1.8 * 0.8);
  const windowArea = windows * (1.2 * 1.0);

  // Teto (opcional)
  const ceilingArea = includeCeiling ? width * length : 0;

  return Math.max(0, wallArea - doorArea - windowArea + ceilingArea);
}

/**
 * Formata o resultado do cálculo em texto amigável para o chatbot
 */
export function formatPaintCalculation(
  area: number,
  coverage: number,
  coats: number,
  productName: string,
): string {
  const result = calculatePaint({ area, coats, coverage });

  const best = result.recommendedPackages[0];
  const lines = [
    `📊 **Cálculo para ${area}m²:**`,
    `• Litros necessários: ~${result.litersWithWaste}L (com 10% de margem)`,
    `• Melhor opção: **${best.quantity} × ${best.size}** de ${productName}`,
    `• Total: ${best.totalLiters}L (sobra de ${best.wastePercent.toFixed(0)}%)`,
  ];

  return lines.join('\n');
}
