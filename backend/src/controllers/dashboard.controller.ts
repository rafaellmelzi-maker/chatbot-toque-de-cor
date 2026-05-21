import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';

const dashboardService = new DashboardService();

export class DashboardController {
  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { period = '30d' } = req.query as { period: string };
      const stats = await dashboardService.getStats(req.user!.tenantId, period);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  };

  getConversationsChart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { period = '30d' } = req.query as { period: string };
      const data = await dashboardService.getConversationsChart(req.user!.tenantId, period);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getTopProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getTopProducts(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getLeadsFunnel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getLeadsFunnel(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getStorePerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getStorePerformance(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
