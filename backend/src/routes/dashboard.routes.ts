import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const ctrl = new DashboardController();

router.get('/stats', authenticate, ctrl.getStats);
router.get('/conversations/chart', authenticate, ctrl.getConversationsChart);
router.get('/products/top', authenticate, ctrl.getTopProducts);
router.get('/leads/funnel', authenticate, ctrl.getLeadsFunnel);
router.get('/stores/performance', authenticate, ctrl.getStorePerformance);

export default router;
