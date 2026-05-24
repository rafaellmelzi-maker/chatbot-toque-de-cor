import { Router } from 'express';
import { defaultRateLimiter } from '../middleware/rateLimiter';
import authRouter from './auth.routes';
import chatRouter from './chat.routes';
import productRouter from './product.routes';
import leadRouter from './lead.routes';
import storeRouter from './store.routes';
import userRouter from './user.routes';
import dashboardRouter from './dashboard.routes';
import whatsappRouter from './whatsapp.routes';
import conversationRouter from './conversation.routes';
import settingsRouter from './settings.routes';
import distributionRouter from './distribution.routes';

export const apiRouter = Router();

apiRouter.use(defaultRateLimiter);

apiRouter.use('/auth', authRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/leads', leadRouter);
apiRouter.use('/stores', storeRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/webhooks', whatsappRouter);
apiRouter.use('/conversations', conversationRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/distribution', distributionRouter);
