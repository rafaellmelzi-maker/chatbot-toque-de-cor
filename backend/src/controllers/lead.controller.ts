import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LeadService } from '../services/lead.service';

const leadService = new LeadService();

export class LeadController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '20', status, storeId } = req.query as Record<string, string>;
      const result = await leadService.list(req.user!.tenantId, {
        page: parseInt(page), limit: parseInt(limit), status, storeId,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await leadService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        name: z.string().optional(), email: z.string().email().optional(),
        notes: z.string().optional(), assignedUserId: z.string().uuid().optional(),
      });
      const data = schema.parse(req.body);
      const lead = await leadService.update(req.params.id, req.user!.tenantId, data);
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const lead = await leadService.updateStatus(req.params.id, req.user!.tenantId, status);
      res.json({ success: true, data: lead });
    } catch (err) { next(err); }
  };
}
