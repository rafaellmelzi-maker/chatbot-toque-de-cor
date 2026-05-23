import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const ctrl = new SettingsController();

router.get('/ai-config', authenticate, ctrl.getAIConfig);
router.put('/ai-config', authenticate, ctrl.updateAIConfig);

export default router;
