import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StoreService } from '../services/store.service';

const storeService = new StoreService();

const createSchema = z.object({
  name: z.string().min(2), code: z.string().min(2),
  cnpj: z.string().optional(), phone: z.string().optional(),
  whatsapp: z.string().optional(), email: z.string().email().optional(),
  address: z.string().optional(), city: z.string().optional(),
  state: z.string().optional(), zipCode: z.string().optional(),
});

export class StoreController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stores = await storeService.list(req.user!.tenantId);
      res.json({ success: true, data: stores });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await storeService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: store });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      const store = await storeService.create(req.user!.tenantId, data);
      res.status(201).json({ success: true, data: store });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.partial().parse(req.body);
      const store = await storeService.update(req.params.id, req.user!.tenantId, data);
      res.json({ success: true, data: store });
    } catch (err) { next(err); }
  };

  connectWhatsApp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await storeService.connectWhatsApp(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  getQRCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await storeService.getQRCode(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };
}
