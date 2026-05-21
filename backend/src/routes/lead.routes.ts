import { Router } from 'express';
import { LeadController } from '../controllers/lead.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const ctrl = new LeadController();

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.put('/:id', authenticate, ctrl.update);
router.patch('/:id/status', authenticate, ctrl.updateStatus);

export default router;
