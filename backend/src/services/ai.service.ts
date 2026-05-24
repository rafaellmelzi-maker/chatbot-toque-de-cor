import { OPENAI_CONFIG } from '../config/openai';
import { genAI, GEMINI_CONFIG } from '../config/gemini';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { RAGService } from './rag.service';
import { logger } from '../utils/logger';
import {
  SYSTEM_PROMPT_BASE,
  INTENT_DETECTION_PROMPT,
  SUMMARY_PROMPT,
} from '../ai/prompts';
import { formatPaintCalculation } from '../utils/paintCalculator';

export interface SessionData {
  surface?: string;
  environment?: string;
  area?: number;
  color?: string;
  finish?: string;
  budget?: number;
  projectType?: string;
  surfaceState?: string;
  customerName?: string;
  [key: string]: unknown;
}

interface IntentAnalysis {
  intent: 'COMPRA' | 'DÚVIDA_TÉCNICA' | 'ORÇAMENTO' | 'TRANSFERIR_HUMANO' | 'RECLAMAÇÃO' | 'OUTRO';
  collectedData: Partial<SessionData>;
  purchaseScore: number;
  shouldTransfer: boolean;
  transferReason?: string;
}

const ragService = new RAGService();
const SESSION_PREFIX = 'ai:session:';
const CONTEXT_TTL = 60 * 60 * 6; // 6 horas

export class AIService {
  /**
   * Processa uma mensagem e retorna a resposta da IA
   */
  async processMessage(
    conversationId: string,
    userMessage: string,
    tenantId: string,
    sessionData: SessionData = {},
  ): Promise<{
    response: string;
    intent: IntentAnalysis;
    updatedSessionData: SessionData;
    shouldTransfer: boolean;
    tokensUsed: number;
  }> {
    // 1. Busca configuração da IA do tenant
    const aiConfig = await this.getAIConfig(tenantId);

    // 2. Busca histórico de mensagens (memória curta – últimas 15 mensagens)
    const messages = await this.getConversationHistory(conversationId);

    // 3. RAG: busca produtos relevantes para a mensagem
    const ragProducts = await ragService.searchSimilarProducts(tenantId, userMessage, 4);
    const productContext = ragService.formatProductsForPrompt(ragProducts);

    // 4. Detecta intenção e extrai dados coletados
    const intent = await this.detectIntent(userMessage, messages.slice(-5));
    const updatedSessionData = { ...sessionData, ...intent.collectedData };

    // 4.5. Override determinístico — não depende do LLM para transferências críticas
    const deterministicCheck = this.checkTransferRequired(userMessage, updatedSessionData);
    if (deterministicCheck.transfer) {
      intent.shouldTransfer = true;
      intent.intent = 'TRANSFERIR_HUMANO';
      intent.transferReason = deterministicCheck.reason ?? intent.transferReason;
    }

    // 5. Monta contexto do cliente
    const customerContext = this.buildCustomerContext(updatedSessionData);

    // 6. Constrói a mensagem do sistema
    const systemPrompt = (aiConfig?.systemPrompt ?? SYSTEM_PROMPT_BASE)
      .replace('{customerContext}', customerContext)
      .replace('{productContext}', productContext)
      .replace('{conversationSummary}', '');

    // 7. Gera resposta com Gemini
    const geminiModel = genAI.getGenerativeModel({
      model: GEMINI_CONFIG.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: aiConfig?.maxTokens ?? GEMINI_CONFIG.maxTokens,
        temperature: aiConfig?.temperature ?? GEMINI_CONFIG.temperature,
      },
    });

    const rawHistory = messages.map((m) => ({
      role: m.role === 'USER' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));

    // Gemini exige que o histórico comece com 'user'
    const firstUserIdx = rawHistory.findIndex((m) => m.role === 'user');
    const geminiHistory = firstUserIdx > 0 ? rawHistory.slice(firstUserIdx) : rawHistory;

    const chat = geminiModel.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);
    const response = result.response.text();
    const tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;

    // 8. Adiciona cálculo de tinta se metragem foi mencionada
    let finalResponse = response;
    if (updatedSessionData.area && ragProducts.length > 0) {
      const mainProduct = ragProducts[0].product;
      if (mainProduct.coverage && !response.includes('m²')) {
        finalResponse += '\n\n' + formatPaintCalculation(
          updatedSessionData.area,
          mainProduct.coverage,
          2,
          mainProduct.name,
        );
      }
    }

    // 9. Verifica guardrails
    finalResponse = this.applyGuardrails(finalResponse);

    // 9.5. Anticorrosivo obrigatório para superfícies metálicas
    if (this.isMetalSurface(userMessage) && !this.mentionsAnticorrosive(finalResponse)) {
      finalResponse = '⚠️ Para superfície metálica é OBRIGATÓRIO usar fundo anticorrosivo antes de qualquer tinta — isso previne ferrugem e garante durabilidade!\n\n' + finalResponse;
    }

    // 9.6. Alerta para número excessivo de demãos
    const demaoCheck = this.checkExcessiveDemaos(userMessage);
    if (demaoCheck.excessive && !finalResponse.includes('empolamento')) {
      finalResponse = `⚠️ Atenção: aplicar ${demaoCheck.count} demãos pode causar empolamento, descascamento e acabamento irregular. O recomendado é 2 a 3 demãos com uma tinta de qualidade — garante resultado perfeito com economia!\n\n` + finalResponse;
    }

    return {
      response: finalResponse,
      intent,
      updatedSessionData,
      shouldTransfer: intent.shouldTransfer || intent.purchaseScore >= 80,
      tokensUsed,
    };
  }

  /**
   * Gera resumo da conversa para o vendedor humano
   */
  async generateConversationSummary(
    conversationId: string,
    sessionData: SessionData,
    recommendedProducts: Array<{ name: string; quantity?: number; estimatedPrice?: number }>,
  ): Promise<{
    customerName: string;
    project: string;
    recommendedProducts: Array<{ name: string; quantity: string; unit: string; estimatedPrice: number }>;
    estimatedTotal: number;
    observations: string;
    nextStep: string;
    qualificationScore: number;
  }> {
    const messages = await this.getConversationHistory(conversationId, 30);

    const prompt = SUMMARY_PROMPT
      .replace('{messages}', messages.map((m) => `${m.role}: ${m.content}`).join('\n'))
      .replace('{sessionData}', JSON.stringify(sessionData, null, 2))
      .replace('{products}', JSON.stringify(recommendedProducts, null, 2));

    const jsonModel = genAI.getGenerativeModel({
      model: GEMINI_CONFIG.model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    });
    const summaryResult = await jsonModel.generateContent(prompt);

    try {
      return JSON.parse(summaryResult.response.text());
    } catch {
      logger.error('Falha ao parsear resumo da IA');
      return {
        customerName: sessionData.customerName ?? 'Cliente',
        project: sessionData.surface ? `Pintura de ${sessionData.surface}` : 'Projeto de pintura',
        recommendedProducts: [],
        estimatedTotal: 0,
        observations: 'Resumo automático não disponível.',
        nextStep: 'Entrar em contato com o cliente',
        qualificationScore: 50,
      };
    }
  }

  private async detectIntent(message: string, recentHistory: Array<{ role: string; content: string }>): Promise<IntentAnalysis> {
    const historyText = recentHistory.map((m) => `${m.role}: ${m.content}`).join('\n');
    const prompt = INTENT_DETECTION_PROMPT
      .replace('{message}', message)
      .replace('{history}', historyText);

    try {
      const intentModel = genAI.getGenerativeModel({
        model: GEMINI_CONFIG.model,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 300,
        },
      });
      const intentResult = await intentModel.generateContent(prompt);
      return JSON.parse(intentResult.response.text()) as IntentAnalysis;
    } catch {
      return {
        intent: 'OUTRO',
        collectedData: {},
        purchaseScore: 0,
        shouldTransfer: false,
      };
    }
  }

  /**
   * Verificação determinística de transferência — não depende do LLM
   * Garante transferência para: pedidos explícitos, frustração, projetos grandes, pedidos de preço
   */
  private checkTransferRequired(
    message: string,
    sessionData: SessionData,
  ): { transfer: boolean; reason: string | null } {
    // A) Pedido explícito de atendimento humano
    const humanPatterns = [
      /quero?\s+falar\s+(com\s+)?(um\s+)?(humano|pessoa|vendedor|atendente|consultor|especialista)/i,
      /me?\s+(passa|conecta|coloca|fala)\s+(com\s+)?(um\s+)?(humano|pessoa|vendedor|atendente|consultor)/i,
      /(preciso|quero|gostaria|queria)\s+(de\s+)?(um\s+)?(humano|pessoa|vendedor|atendente|consultor)/i,
      /atendimento\s+humano/i,
      /falar\s+com\s+(algu[eé]m|gente|uma\s+pessoa)/i,
      /vendedor?\s+humano/i,
      /chega\s+de\s+(rob[oô]|bot|m[aá]quina|virtual)/i,
      /quero\s+(um\s+)?humano/i,
      /n[aã]o\s+quero\s+(mais\s+)?(rob[oô]|bot|virtual)/i,
    ];
    for (const p of humanPatterns) {
      if (p.test(message)) {
        return { transfer: true, reason: 'Pedido explícito de atendimento humano' };
      }
    }

    // B) Frustração extrema
    const stripped = message.replace(/\s/g, '');
    const upperCount = (stripped.match(/[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇ]/g) ?? []).length;
    const capsRatio = stripped.length > 0 ? upperCount / stripped.length : 0;
    const exclamCount = (message.match(/!/g) ?? []).length;
    const frustrationWords =
      /\b(chega|basta|horr[ií]vel|p[eé]ssimo|incompetente|rid[ií]culo|absurdo|lament[aá]vel|uma\s+merda|que\s+droga)\b/i;

    if (capsRatio >= 0.6 && message.replace(/\s/g, '').length > 8) {
      return { transfer: true, reason: 'Frustração detectada — mensagem em CAPS LOCK' };
    }
    if (exclamCount >= 3) {
      return { transfer: true, reason: 'Frustração detectada — múltiplas exclamações' };
    }
    if (frustrationWords.test(message)) {
      return { transfer: true, reason: 'Frustração detectada — vocabulário negativo intenso' };
    }

    // C) Projeto de grande porte / corporativo
    if (typeof sessionData.area === 'number' && sessionData.area >= 500) {
      return { transfer: true, reason: 'Projeto de grande porte (≥ 500 m²)' };
    }
    const areaMatch = message.match(/(\d[\d.,]*)\s*m[²2]/i);
    if (areaMatch) {
      const rawNum = areaMatch[1].replace(/\./g, '').replace(',', '.');
      const area = parseFloat(rawNum);
      if (!isNaN(area) && area >= 500) {
        return { transfer: true, reason: `Grande área detectada: ${area} m²` };
      }
    }
    if (
      /\b(condom[ií]nio|galp[aã]o|construtora|incorporadora|empresa|pr[eé]dio\s+inteiro|m[uú]ltiplos\s+ambientes|obra\s+comercial|grande\s+obra)\b/i.test(
        message,
      )
    ) {
      return { transfer: true, reason: 'Projeto corporativo / grande obra' };
    }

    // D) Pedido de preço ou orçamento — proibido responder, redirecionar para vendedor
    if (
      /\b(pre[cç]o|valor(es)?|quanto\s+(custa|fica|vale|cobram?|sai)|or[cç]amento|desconto|promo[cç][aã]o|tabela\s+de\s+pre[cç]|mais\s+barato|custo|investimento|cobram)\b/i.test(
        message,
      )
    ) {
      return { transfer: true, reason: 'Solicitação de preço ou orçamento' };
    }

    return { transfer: false, reason: null };
  }

  private buildCustomerContext(sessionData: SessionData): string {
    const lines: string[] = [];
    if (sessionData.customerName) lines.push(`Nome: ${sessionData.customerName}`);
    if (sessionData.projectType) lines.push(`Tipo de projeto: ${sessionData.projectType}`);
    if (sessionData.surface) lines.push(`Superfície: ${sessionData.surface}`);
    if (sessionData.environment) lines.push(`Ambiente: ${sessionData.environment}`);
    if (sessionData.area) lines.push(`Metragem: ${sessionData.area} m²`);
    if (sessionData.color) lines.push(`Cor desejada: ${sessionData.color}`);
    if (sessionData.finish) lines.push(`Acabamento: ${sessionData.finish}`);
    if (sessionData.budget) lines.push(`Orçamento: R$ ${sessionData.budget}`);
    if (sessionData.surfaceState) lines.push(`Estado da superfície: ${sessionData.surfaceState}`);

    return lines.length > 0
      ? lines.join('\n')
      : 'Informações do projeto ainda não coletadas.';
  }

  private isMetalSurface(message: string): boolean {
    return /\b(ferro|metal|portão|portao|grades?|alumín[io]+|alumin[io]+|aço|aco|metalon|estrutura\s+met[aá]l|superf[ií]cie\s+met[aá]l)/i.test(message);
  }

  private mentionsAnticorrosive(response: string): boolean {
    return /\b(anticorrosivo|fundo\s+anticorrosivo|primer|zarc[aã]o|proteção\s+contra\s+ferrugem|fundo\s+met[aá]lico|esmalte\s+sint[eé]tico)/i.test(response);
  }

  private checkExcessiveDemaos(message: string): { excessive: boolean; count: number } {
    const match = message.match(/\b(\d+)\s*dem[aã]os?\b/i);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count > 4) return { excessive: true, count };
    }
    return { excessive: false, count: 0 };
  }

  private applyGuardrails(response: string): string {
    let safe = response;

    // 1. Filtro de marcas proibidas
    if (/\b(coral|lukscolor|hydronorth|novotex|eucatex|renner|novacor|palmares)\b/i.test(safe)) {
      return 'Aqui na Toque de Cor trabalhamos exclusivamente com Suvinil e Sherwin-Williams — marcas premium com produtos de alta qualidade para qualquer projeto. Como posso te ajudar a encontrar a opção ideal?';
    }

    // 2. Filtro de exposição do system prompt
    const safeLower = safe.toLowerCase();
    const promptLeaks = [
      'você é o tintor, assistente virtual especializado',
      'vendedor técnico experiente',
      'primeiras 100 palavras das minhas instruções',
      'primeiras 50 palavras',
    ];
    if (promptLeaks.some((p) => safeLower.includes(p))) {
      return 'Sou o TINTOR, especialista em tintas Suvinil e Sherwin-Williams da Toque de Cor! Como posso ajudar com seu projeto?';
    }

    // 3. Substitui padrões que indicariam ser uma IA
    const aiPatterns = [
      /como (um|uma) (modelo de linguagem|ia|inteligência artificial|assistente virtual)/gi,
      /sou (um|uma) (ia|inteligência artificial|robô|bot)/gi,
      /não (tenho|possuo) (consciência|sentimentos|emoções) reais/gi,
    ];

    for (const pattern of aiPatterns) {
      safe = safe.replace(pattern, 'como consultor especializado em tintas');
    }

    // 4. Limita tamanho para não sobrecarregar o WhatsApp
    if (safe.length > 1500) {
      const truncated = safe.substring(0, 1400);
      const lastSentence = truncated.lastIndexOf('. ');
      safe = truncated.substring(0, lastSentence + 1) + '\n\n_Posso continuar explicando se precisar!_';
    }

    return safe;
  }

  private async getAIConfig(tenantId: string) {
    const cacheKey = `aiconfig:${tenantId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const config = await prisma.aIConfig.findUnique({ where: { tenantId } });
    if (config) await redis.setex(cacheKey, 300, JSON.stringify(config));
    return config;
  }

  private async getConversationHistory(
    conversationId: string,
    limit = 15,
  ): Promise<Array<{ role: string; content: string }>> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { role: true, content: true },
    });
    return messages.reverse();
  }
}
