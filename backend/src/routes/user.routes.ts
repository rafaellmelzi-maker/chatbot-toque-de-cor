import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const ctrl = new UserController();

router.get('/', authenticate, authorize('TENANT_ADMIN', 'STORE_MANAGER', 'SUPER_ADMIN'), ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.create);
router.put('/:id', authenticate, ctrl.update);
router.delete('/:id', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.remove);

export default router;
