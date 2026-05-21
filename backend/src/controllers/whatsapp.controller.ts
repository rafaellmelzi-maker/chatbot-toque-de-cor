import { Request, Response, NextFunction } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import crypto from 'crypto';

const whatsappService = new WhatsAppService();

export class WhatsAppController {
  handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Valida assinatura do webhook (se configurada)
      if (env.WEBHOOK_SECRET) {
        const signature = req.headers['x-webhook-signature'] as string;
        const expectedSig = crypto
          .createHmac('sha256', env.WEBHOOK_SECRET)
          .update(JSON.stringify(req.body))
          .digest('hex');
        if (signature !== `sha256=${expectedSig}`) {
          logger.warn('Webhook com assinatura inválida');
          return res.status(401).json({ error: 'Assinatura inválida' });
        }
      }

      // Responde 200 imediatamente para a Evolution API não retentar
      res.status(200).json({ received: true });

      // Processa de forma assíncrona
      setImmediate(() => {
        whatsappService.processWebhook(req.body).catch((err) => {
          logger.error('Erro ao processar webhook WhatsApp:', err);
        });
      });
    } catch (err) {
      next(err);
    }
  };
}
