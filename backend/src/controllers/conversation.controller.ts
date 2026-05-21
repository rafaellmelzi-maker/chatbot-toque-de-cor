import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ConversationService } from '../services/conversation.service';

const conversationService = new ConversationService();

export class ConversationController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '20', status, storeId } = req.query as Record<string, string>;
      const result = await conversationService.list(req.user!.tenantId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        storeId,
        userId: req.user!.role === 'SELLER' ? req.user!.sub : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await conversationService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  transferToHuman = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sellerId } = z.object({ sellerId: z.string().uuid().optional() }).parse(req.body);
      const data = await conversationService.transferToHuman(
        req.params.id,
        req.user!.tenantId,
        sellerId ?? req.user!.sub,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  resolve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await conversationService.resolve(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  sendHumanMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message } = z.object({ message: z.string().min(1) }).parse(req.body);
      const data = await conversationService.sendHumanMessage(
        req.params.id,
        req.user!.tenantId,
        req.user!.sub,
        message,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
