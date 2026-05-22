import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const EVOLUTION_BASE = env.EVOLUTION_API_URL;
const EVOLUTION_KEY = env.EVOLUTION_API_KEY;

async function evolutionFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${EVOLUTION_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_KEY ?? '',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${text}`);
  }

  return res.json();
}

export class WhatsAppService {
  /**
   * Processa webhook recebido da Evolution API
   */
  async processWebhook(payload: Record<string, unknown>) {
    const event = payload.event as string;

    if (event === 'messages.upsert') {
      await this.handleIncomingMessage(payload);
    } else if (event === 'connection.update') {
      await this.handleConnectionUpdate(payload);
    }
  }

  private async handleIncomingMessage(payload: Record<string, unknown>) {
    const data = payload.data as Record<string, unknown>;
    const instanceName = payload.instance as string;
    const key = data?.key as Record<string, unknown>;
    const message = data?.message as Record<string, unknown>;

    // Ignora mensagens enviadas pelo próprio número
    if (key?.fromMe) return;

    const remoteJid = key?.remoteJid as string;
    if (!remoteJid || remoteJid.includes('@g.us')) return; // ignora grupos

    const phone = remoteJid.replace('@s.whatsapp.net', '');
    const text =
      (message?.conversation as string) ||
      (message?.extendedTextMessage as Record<string, string>)?.text ||
      '';

    if (!text.trim()) return;

    // Encontra a instância WhatsApp pelo instanceName → tenantId
    const instance = await prisma.whatsAppInstance.findUnique({ where: { instanceName } });

    if (!instance) {
      logger.warn(`Instância WhatsApp não encontrada: ${instanceName}`);
      return;
    }

    const { tenantId } = instance;

    // Encontra conversa ativa para este telefone
    let conversation = await prisma.conversation.findFirst({
      where: { tenantId, whatsappPhone: phone, status: { in: ['BOT', 'WAITING'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      // Novo contato → cria conversa aguardando seleção de loja
      let customer = await prisma.customer.findUnique({
        where: { tenantId_phone: { tenantId, phone } },
      });
      if (!customer) {
        customer = await prisma.customer.create({ data: { tenantId, phone } });
      }
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          channel: 'WHATSAPP',
          whatsappPhone: phone,
          customerId: customer.id,
          sessionData: { state: 'AWAITING_STORE' },
        },
      });
      await this.sendStoreMenu(tenantId, phone, instanceName);
      return;
    }

    const sessionData = (conversation.sessionData as Record<string, unknown>) ?? {};

    // Aguardando seleção de loja
    if (!conversation.storeId || sessionData['state'] === 'AWAITING_STORE') {
      await this.handleStoreSelection(conversation, text, tenantId, phone, instanceName);
      return;
    }

    // Fluxo normal de chat com IA da loja selecionada
    if (conversation.status === 'BOT') {
      const { ChatService } = await import('./chat.service');
      const chatService = new ChatService();
      const result = await chatService.processMessage(conversation.id, text, tenantId);
      await this.sendRawMessage(instanceName, phone, result.response);
    }
  }

  /** Envia menu de seleção de loja */
  private async sendStoreMenu(tenantId: string, phone: string, instanceName: string): Promise<void> {
    const stores = await prisma.store.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true, city: true, state: true },
    });

    const list = stores
      .map((s, i) => `${i + 1}. ${s.name.replace('Toque de Cor – ', '')}${s.city ? ` – ${s.city}/${s.state}` : ''}`)
      .join('\n');

    const text = `Olá! Bem-vindo à *Toque de Cor*! 🎨\n\nEscolha a loja mais próxima:\n\n${list}\n\nDigite o *número* da loja:`;
    await this.sendRawMessage(instanceName, phone, text);
  }

  /** Processa a resposta do cliente com o número da loja */
  private async handleStoreSelection(
    conversation: { id: string; tenantId: string },
    text: string,
    tenantId: string,
    phone: string,
    instanceName: string,
  ): Promise<void> {
    const stores = await prisma.store.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });

    const idx = parseInt(text.trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= stores.length) {
      await this.sendRawMessage(instanceName, phone, `Por favor, digite apenas o *número* da loja desejada.`);
      await this.sendStoreMenu(tenantId, phone, instanceName);
      return;
    }

    const store = stores[idx];

    // Atualiza conversa com a loja escolhida
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        storeId: store.id,
        sessionData: { state: 'CHATTING', storeSelectedAt: new Date().toISOString() },
      },
    });

    // Mensagem de boas-vindas da loja
    const aiConfig = await prisma.aIConfig.findUnique({ where: { tenantId } });
    const welcome = aiConfig?.welcomeMessage ?? 'Olá! 👋 Como posso te ajudar hoje?';
    const greeting = `Ótimo! Você escolheu *${store.name.replace('Toque de Cor – ', '')}*.\n\n${welcome}`;

    await this.sendRawMessage(instanceName, phone, greeting);
    await prisma.message.create({
      data: { conversationId: conversation.id, role: 'ASSISTANT', content: welcome, isFromBot: true },
    });
  }

  private async handleConnectionUpdate(payload: Record<string, unknown>) {
    const instanceName = payload.instance as string;
    const data = payload.data as Record<string, string>;

    const statusMap: Record<string, string> = {
      open: 'CONNECTED',
      close: 'DISCONNECTED',
      connecting: 'CONNECTING',
    };

    const newStatus = statusMap[data?.state ?? ''] ?? 'DISCONNECTED';

    await prisma.whatsAppInstance.updateMany({
      where: { instanceName },
      data: {
        status: newStatus as 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'BANNED',
        ...(data?.state === 'open' && { qrCode: null }),
      },
    });

    logger.info(`WhatsApp ${instanceName}: ${newStatus}`);
  }

  /** Envia mensagem diretamente via Evolution API */
  private async sendRawMessage(instanceName: string, phone: string, text: string): Promise<void> {
    await evolutionFetch(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number: phone, text, delay: 1200 }),
    });
  }

  /**
   * Envia mensagem de texto via WhatsApp (usado por vendedores humanos)
   * @param tenantId - ID do tenant (número único por tenant)
   */
  async sendMessage(tenantId: string, phone: string, text: string): Promise<void> {
    const instance = await prisma.whatsAppInstance.findFirst({ where: { tenantId, status: 'CONNECTED' } });
    if (!instance) {
      logger.warn(`Sem instância WhatsApp ativa para tenant ${tenantId}`);
      return;
    }
    await this.sendRawMessage(instance.instanceName, phone, text);
  }

  /**
   * Cria instância WhatsApp para o tenant (número único para todas as lojas)
   */
  async createInstance(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError('Tenant não encontrado', 404);

    const instanceName = `toque-de-cor-${tenant.slug}`;

    // Tenta criar na Evolution API (ignora erro se já existir)
    try {
      await evolutionFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: `${env.BACKEND_URL ?? 'http://backend:3001'}/api/webhooks/whatsapp`,
          webhookByEvents: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        }),
      });
    } catch (err: any) {
      // Instância já existe na Evolution API — continua
      if (!err?.message?.includes('already')) throw err;
    }

    const instance = await prisma.whatsAppInstance.upsert({
      where: { instanceName },
      update: { status: 'CONNECTING' },
      create: { tenantId, instanceName, status: 'CONNECTING' },
    });

    return instance;
  }

  /**
   * Obtém QR code para conexão do tenant
   */
  async getQRCode(tenantId: string) {
    const instance = await prisma.whatsAppInstance.findFirst({ where: { tenantId } });
    if (!instance) throw new AppError('Instância não encontrada. Clique em "Conectar" primeiro.', 404);

    try {
      const data = await evolutionFetch(`/instance/connect/${instance.instanceName}`);
      const qrCode = data?.base64 ?? data?.qrcode?.base64;

      if (qrCode) {
        await prisma.whatsAppInstance.update({ where: { id: instance.id }, data: { qrCode } });
      }

      return { qrCode, status: instance.status };
    } catch {
      return { qrCode: instance.qrCode, status: instance.status };
    }
  }

  /**
   * Retorna status da instância WhatsApp do tenant
   */
  async getStatus(tenantId: string) {
    const instance = await prisma.whatsAppInstance.findFirst({ where: { tenantId } });
    return {
      connected: instance?.status === 'CONNECTED',
      status: instance?.status ?? 'DISCONNECTED',
      phone: instance?.phone ?? null,
    };
  }
}
