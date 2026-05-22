import { Router } from 'express';
import { StoreController } from '../controllers/store.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const ctrl = new StoreController();

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.create);
router.put('/:id', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.update);

// Rotas de WhatsApp global (número único para todas as lojas)
router.post('/whatsapp/connect', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.connectWhatsApp);
router.get('/whatsapp/qr', authenticate, ctrl.getQRCode);
router.get('/whatsapp/status', authenticate, ctrl.getWhatsAppStatus);

export default router;
