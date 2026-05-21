import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  tenantSlug: z.string().optional(),
});

export class AuthController {
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, tenantSlug } = loginSchema.parse(req.body);
      const result = await authService.login(email, password, tenantSlug);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
      const result = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(req.body);
      if (refreshToken) await authService.revokeToken(refreshToken);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getUserById(req.user!.sub);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };
}
