import { Router } from 'express';
import { MessageDirection, Severity, TicketStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { translateText } from '../services/translation';
import { sendWhatsAppText } from '../services/whatsapp';

export function createTicketRouter(io: any) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const tickets = await prisma.ticket.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { agent: true, messages: { orderBy: { createdAt: 'asc' } } },
        take: 100
      });
      res.json({ tickets });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: { agent: true, messages: { orderBy: { createdAt: 'asc' } } }
      });
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ ticket });
    } catch (error) {
      next(error);
    }
  });

  const patchSchema = z.object({
    status: z.nativeEnum(TicketStatus).optional(),
    severity: z.nativeEnum(Severity).optional(),
    assignedTo: z.string().nullable().optional(),
    summary: z.string().optional()
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const body = patchSchema.parse(req.body);
      const data: any = { ...body };
      if (body.status === TicketStatus.RESOLVED) data.resolvedAt = new Date();
      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data,
        include: { agent: true, messages: { orderBy: { createdAt: 'asc' } } }
      });
      io.emit('ticket:update', ticket);
      res.json({ ticket });
    } catch (error) {
      next(error);
    }
  });

  const replySchema = z.object({
    body: z.string().min(1),
    targetLanguage: z.enum(['ht', 'fr', 'es', 'en']).optional()
  });

  router.post('/:id/messages', async (req, res, next) => {
    try {
      const input = replySchema.parse(req.body);
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: { agent: true } });
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      const targetLanguage = input.targetLanguage ?? (ticket.agent.preferredLanguage as any) ?? 'ht';
      const translated = await translateText(input.body, targetLanguage, 'en');
      const sendResult = await sendWhatsAppText({ to: ticket.agent.phoneNumber, body: translated.translatedText });

      const message = await prisma.message.create({
        data: {
          ticketId: ticket.id,
          agentId: ticket.agent.id,
          direction: MessageDirection.OUTBOUND,
          toNumber: ticket.agent.phoneNumber,
          bodyOriginal: input.body,
          bodyTranslated: translated.translatedText,
          language: translated.targetLanguage,
          confidence: translated.confidence,
          translationProvider: translated.provider,
          rawPayload: sendResult as any
        }
      });

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.WAITING_ON_AGENT,
          firstResponseAt: ticket.firstResponseAt ?? new Date()
        }
      });

      io.emit('message:new', message);
      res.status(201).json({ message, sendResult });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
