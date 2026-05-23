import { Router } from 'express';
import { MessageDirection, TicketStatus } from '@prisma/client';
import { z } from 'zod';
import { env } from '../env';
import { prisma } from '../prisma';
import { classifyIssue } from '../services/classifier';
import { translateText } from '../services/translation';
import { extractTextMessages } from '../services/whatsapp';
import { makeTicketShortCode } from '../utils/shortCode';

async function findOrCreateTicket(agentId: string, issueKey: string, classification: ReturnType<typeof classifyIssue>, language: string, branchId?: string | null, region?: string | null) {
  const existing = await prisma.ticket.findFirst({
    where: {
      agentId,
      issueKey,
      status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_ON_AGENT] }
    },
    orderBy: { updatedAt: 'desc' }
  });

  if (existing) return existing;

  return prisma.ticket.create({
    data: {
      shortCode: makeTicketShortCode(region?.slice(0, 2) || 'HT'),
      agentId,
      severity: classification.severity,
      category: classification.category,
      issueKey,
      title: classification.title,
      summary: classification.summary,
      language,
      branchId: branchId ?? undefined,
      region: region ?? undefined
    }
  });
}

export function createWhatsAppWebhookRouter(io: any) {
  const router = Router();

  router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  router.post('/', async (req, res, next) => {
    try {
      const messages = extractTextMessages(req.body);
      for (const inbound of messages) {
        const agent = await prisma.agent.upsert({
          where: { phoneNumber: inbound.from },
          update: {},
          create: { phoneNumber: inbound.from, preferredLanguage: 'ht' }
        });
        const translated = await translateText(inbound.text, 'en');
        const classification = classifyIssue(`${inbound.text}\n${translated.translatedText}`, agent.branchId);
        const ticket = await findOrCreateTicket(
          agent.id,
          classification.issueKey,
          classification,
          translated.sourceLanguage,
          agent.branchId,
          agent.region
        );

        const message = await prisma.message.create({
          data: {
            ticketId: ticket.id,
            agentId: agent.id,
            direction: MessageDirection.INBOUND,
            fromNumber: inbound.from,
            bodyOriginal: inbound.text,
            bodyTranslated: translated.translatedText,
            language: translated.sourceLanguage,
            confidence: translated.confidence,
            translationProvider: translated.provider,
            rawPayload: inbound.raw as any
          }
        });

        const hydrated = await prisma.ticket.findUnique({
          where: { id: ticket.id },
          include: { agent: true, messages: { orderBy: { createdAt: 'asc' } } }
        });
        io.emit('ticket:update', hydrated);
        io.emit('message:new', message);
      }

      return res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });

  const simulateSchema = z.object({
    from: z.string().min(4),
    text: z.string().min(1),
    name: z.string().optional(),
    branchId: z.string().optional(),
    region: z.string().optional(),
    preferredLanguage: z.enum(['ht', 'fr', 'es', 'en']).optional()
  });

  router.post('/simulate-inbound', async (req, res, next) => {
    try {
      const input = simulateSchema.parse(req.body);
      const agent = await prisma.agent.upsert({
        where: { phoneNumber: input.from },
        update: {
          displayName: input.name,
          branchId: input.branchId,
          region: input.region,
          preferredLanguage: input.preferredLanguage ?? 'ht'
        },
        create: {
          phoneNumber: input.from,
          displayName: input.name,
          branchId: input.branchId,
          region: input.region,
          preferredLanguage: input.preferredLanguage ?? 'ht'
        }
      });

      const translated = await translateText(input.text, 'en');
      const classification = classifyIssue(`${input.text}\n${translated.translatedText}`, input.branchId);
      const ticket = await findOrCreateTicket(agent.id, classification.issueKey, classification, translated.sourceLanguage, input.branchId, input.region);
      const message = await prisma.message.create({
        data: {
          ticketId: ticket.id,
          agentId: agent.id,
          direction: MessageDirection.INBOUND,
          fromNumber: input.from,
          bodyOriginal: input.text,
          bodyTranslated: translated.translatedText,
          language: translated.sourceLanguage,
          confidence: translated.confidence,
          translationProvider: translated.provider,
          rawPayload: input as any
        }
      });

      const hydrated = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: { agent: true, messages: { orderBy: { createdAt: 'asc' } } }
      });
      io.emit('ticket:update', hydrated);
      io.emit('message:new', message);
      res.status(201).json({ ticket: hydrated, message });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
