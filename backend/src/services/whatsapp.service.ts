import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const EVOLUTION_BASE = env.EVOLUTION_API_URL;
const EVOLUTION_KEY = env.EVOLUTION_API_KEY;

async function evolutionFetch(path: string, options: RequestInit = {}) {
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

    // Encontra a instância WhatsApp
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { instanceName },
      include: { store: true },
    });

    if (!instance) {
      logger.warn(`Instância WhatsApp não encontrada: ${instanceName}`);
      return;
    }

    const tenantId = instance.store.tenantId;

    // Encontra ou cria conversa ativa
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        whatsappPhone: phone,
        status: { in: ['BOT', 'WAITING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      // Nova conversa
      const { ChatService } = await import('./chat.service');
      const chatService = new ChatService();
      const result = await chatService.startConversation({
        tenantId,
        channel: 'WHATSAPP',
        customerPhone: phone,
        storeId: instance.storeId,
      });

      // Envia boas-vindas
      await this.sendMessage(instance.storeId, phone, result.welcomeMessage);

      conversation = await prisma.conversation.findUnique({ where: { id: result.conversationId } });
    }

    if (!conversation) return;

    // Processa mensagem pelo bot (apenas se em modo BOT)
    if (conversation.status === 'BOT') {
      const { ChatService } = await import('./chat.service');
      const chatService = new ChatService();
      const result = await chatService.processMessage(conversation.id, text, tenantId);

      // Envia resposta via WhatsApp
      await this.sendMessage(instance.storeId, phone, result.response);
    }
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

  /**
   * Envia mensagem de texto via WhatsApp
   */
  async sendMessage(storeId: string, phone: string, text: string): Promise<void> {
    const instance = await prisma.whatsAppInstance.findFirst({ where: { storeId, status: 'CONNECTED' } });
    if (!instance) {
      logger.warn(`Sem instância WhatsApp ativa para loja ${storeId}`);
      return;
    }

    await evolutionFetch(`/message/sendText/${instance.instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number: phone,
        text,
        delay: 1200, // delay humanizado em ms
      }),
    });
  }

  /**
   * Cria instância WhatsApp e retorna QR code
   */
  async createInstance(storeId: string, tenantId: string) {
    const store = await prisma.store.findFirst({ where: { id: storeId, tenantId } });
    if (!store) throw new AppError('Loja não encontrada', 404);

    const instanceName = `toque-de-cor-${store.code.toLowerCase()}`;

    // Cria instância na Evolution API
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

    // Salva no banco
    const instance = await prisma.whatsAppInstance.upsert({
      where: { instanceName },
      update: { status: 'CONNECTING' },
      create: {
        storeId,
        instanceName,
        status: 'CONNECTING',
      },
    });

    return instance;
  }

  /**
   * Obtém QR code para conexão
   */
  async getQRCode(storeId: string) {
    const instance = await prisma.whatsAppInstance.findFirst({ where: { storeId } });
    if (!instance) throw new AppError('Instância não encontrada. Conecte primeiro.', 404);

    try {
      const data = await evolutionFetch(`/instance/connect/${instance.instanceName}`);
      const qrCode = data?.base64 ?? data?.qrcode?.base64;

      if (qrCode) {
        await prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: { qrCode },
        });
      }

      return { qrCode, status: instance.status };
    } catch (err) {
      return { qrCode: instance.qrCode, status: instance.status };
    }
  }
}
