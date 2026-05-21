import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const ctrl = new ProductController();

// Leitura – vendedores e acima
router.get('/', authenticate, ctrl.list);
router.get('/search', authenticate, ctrl.search);
router.get('/:id', authenticate, ctrl.getById);

// Escrita – admins apenas
router.post('/', authenticate, authorize('TENANT_ADMIN', 'STORE_MANAGER', 'SUPER_ADMIN'), ctrl.create);
router.put('/:id', authenticate, authorize('TENANT_ADMIN', 'STORE_MANAGER', 'SUPER_ADMIN'), ctrl.update);
router.delete('/:id', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.remove);
router.post('/:id/embed', authenticate, authorize('TENANT_ADMIN', 'SUPER_ADMIN'), ctrl.generateEmbedding);

export default router;
