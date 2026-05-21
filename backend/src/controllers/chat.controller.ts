import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChatService } from '../services/chat.service';
import { AppError } from '../middleware/errorHandler';

const chatService = new ChatService();

const startSchema = z.object({
  tenantId: z.string().uuid(),
  channel: z.enum(['WHATSAPP', 'WEBCHAT']).default('WEBCHAT'),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  storeId: z.string().uuid().optional(),
});

const messageSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  tenantId: z.string().uuid().optional(),
});

export class ChatController {
  startConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = startSchema.parse({ ...req.body, tenantId: req.body.tenantId ?? req.tenantId });
      const conversation = await chatService.startConversation(data);
      res.status(201).json({ success: true, data: conversation });
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = messageSchema.parse(req.body);
      const tenantId = data.tenantId ?? req.tenantId;
      if (!tenantId) throw new AppError('tenantId obrigatório', 400);
      const result = await chatService.processMessage(data.conversationId, data.message, tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;
      const tenantId = req.tenantId ?? (req.query.tenantId as string);
      if (!tenantId) throw new AppError('tenantId obrigatório', 400);
      const history = await chatService.getConversationHistory(conversationId, tenantId);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  };
}
