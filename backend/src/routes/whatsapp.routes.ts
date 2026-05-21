import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { webhookRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const ctrl = new WhatsAppController();

// Webhook chamado pela Evolution API (não requer JWT)
router.post('/whatsapp', webhookRateLimiter, ctrl.handleWebhook);

export default router;
