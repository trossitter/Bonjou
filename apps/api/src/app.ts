import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { env } from './env';
import { requireDashboardAccess } from './middleware/dashboardAccess';
import { createTicketRouter } from './routes/tickets';
import { createWhatsAppWebhookRouter } from './routes/whatsappWebhook';

export function createApp(io: any) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.NODE_ENV === 'production' ? true : env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  if (env.NODE_ENV !== 'test') app.use(pinoHttp());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/tickets', requireDashboardAccess, createTicketRouter(io));
  const webhookRouter = createWhatsAppWebhookRouter(io);
  app.use('/webhooks/whatsapp', webhookRouter);
  app.use('/dev', requireDashboardAccess, webhookRouter);

  if (env.NODE_ENV === 'production') {
    const publicDir = path.resolve(__dirname, 'public');
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status ?? 500;
    console.error(err);
    res.status(status).json({ error: err?.message ?? 'Unexpected server error' });
  });

  return app;
}
