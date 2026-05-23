import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export class SettingsController {
  getAIConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const config = await prisma.aIConfig.findUnique({ where: { tenantId } });

      // Retorna defaults se não existe ainda
      const defaults = {
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 1500,
        welcomeMessage: 'Olá! 👋 Como posso te ajudar hoje?',
        transferMessage: '✅ Conectando você com um consultor especializado!',
        model: 'gpt-4o',
        isRAGEnabled: true,
      };

      res.json({ success: true, data: config ? { ...defaults, ...config } : defaults });
    } catch (err) {
      next(err);
    }
  };

  updateAIConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { systemPrompt, temperature, maxTokens, welcomeMessage, transferMessage, model, isRAGEnabled } = req.body;

      const data: Record<string, unknown> = {};
      if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;
      if (temperature !== undefined) data.temperature = Number(temperature);
      if (maxTokens !== undefined) data.maxTokens = Number(maxTokens);
      if (welcomeMessage !== undefined) data.welcomeMessage = welcomeMessage;
      if (transferMessage !== undefined) data.transferMessage = transferMessage;
      if (model !== undefined) data.model = model;
      if (isRAGEnabled !== undefined) data.isRAGEnabled = Boolean(isRAGEnabled);

      const config = await prisma.aIConfig.upsert({
        where: { tenantId },
        update: data,
        create: { tenantId, ...data },
      });

      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  };
}
