import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { resolveTenant } from '../middleware/auth';

const router = Router();
const ctrl = new ChatController();

// Rotas públicas para o widget/WhatsApp (autenticação via tenant header)
router.use(resolveTenant);
router.post('/message', ctrl.sendMessage);
router.post('/start', ctrl.startConversation);
router.get('/:conversationId/history', ctrl.getHistory);

export default router;
