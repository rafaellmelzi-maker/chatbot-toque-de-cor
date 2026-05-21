import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const ctrl = new ConversationController();

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.patch('/:id/transfer', authenticate, ctrl.transferToHuman);
router.patch('/:id/resolve', authenticate, ctrl.resolve);
router.post('/:id/messages', authenticate, ctrl.sendHumanMessage);

export default router;
