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

  private applyGuardrails(response: string): string {
    // Substitui padrões que indicariam ser uma IA
    const aiPatterns = [
      /como (um|uma) (modelo de linguagem|ia|inteligência artificial|assistente virtual)/gi,
      /sou (um|uma) (ia|inteligência artificial|robô|bot)/gi,
      /não (tenho|possuo) (consciência|sentimentos|emoções) reais/gi,
    ];

    let safe = response;
    for (const pattern of aiPatterns) {
      safe = safe.replace(pattern, 'como consultor especializado em tintas');
    }

    // Limita tamanho para não sobrecarregar o WhatsApp
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
