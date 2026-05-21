import { Router } from 'express';
import { StoreController } from '../controllers/store.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const ctrl = new StoreController();

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.create);
router.put('/:id', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.update);
router.post('/:id/whatsapp/connect', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.connectWhatsApp);
router.get('/:id/whatsapp/qr', authenticate, ctrl.getQRCode);

export default router;
