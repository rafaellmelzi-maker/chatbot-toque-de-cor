import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';

const userService = new UserService();

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  role: z.enum(['TENANT_ADMIN', 'STORE_MANAGER', 'SELLER']).default('SELLER'),
  storeId: z.string().uuid().optional(),
  phone: z.string().optional(),
});

export class UserController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storeId } = req.query as { storeId?: string };
      const users = await userService.list(req.user!.tenantId, storeId);
      res.json({ success: true, data: users });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.parse(req.body);
      const user = await userService.create(req.user!.tenantId, data);
      res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createSchema.omit({ password: true }).partial().parse(req.body);
      const user = await userService.update(req.params.id, req.user!.tenantId, data);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.remove(req.params.id, req.user!.tenantId);
      res.json({ success: true });
    } catch (err) { next(err); }
  };
}
