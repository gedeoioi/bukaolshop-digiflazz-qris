import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimiter } from './middleware/auth';
import { errorHandler } from './middleware/error';
import healthRoutes from './routes/health';
import bukaolshopWebhook from './routes/bukaolshop.webhook';
import paymentWebhook from './routes/payment.webhook';
import digiflazzWebhook from './routes/digiflazz.webhook';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

app.use('/', healthRoutes);
app.use('/api/webhook', bukaolshopWebhook);
app.use('/api/webhook', paymentWebhook);
app.use('/api/webhook', digiflazzWebhook);

app.use(errorHandler);

export { app };
