import http from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageDirection, Severity, TicketStatus } from '@prisma/client';

process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/bonjou?schema=public';
process.env.DASHBOARD_ACCESS_TOKEN = 'test-token';
process.env.NODE_ENV = 'test';
process.env.TRANSLATION_PROVIDER = 'mock';
process.env.WHATSAPP_ENABLED = 'false';

const emit = vi.fn();

const agent = {
  id: 'agent-1',
  phoneNumber: '50937000001',
  displayName: 'Nadia',
  branchId: 'PAP-003',
  region: 'Port-au-Prince',
  preferredLanguage: 'ht',
  createdAt: new Date(),
  updatedAt: new Date()
};

const inboundTicket = {
  id: 'ticket-1',
  shortCode: 'PO-100001',
  status: TicketStatus.OPEN,
  severity: Severity.CRITICAL,
  category: 'transaction_failure',
  title: 'Customer transaction blocked at PAP-003',
  summary: 'Agent reports that customers may be blocked from depositing or withdrawing money.',
  issueKey: 'transaction_failure:deposit',
  sourceChannel: 'whatsapp',
  language: 'ht',
  branchId: 'PAP-003',
  region: 'Port-au-Prince',
  assignedTo: null,
  firstResponseAt: null,
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  agentId: agent.id
};

const inboundMessage = {
  id: 'message-1',
  direction: MessageDirection.INBOUND,
  channel: 'whatsapp',
  fromNumber: agent.phoneNumber,
  toNumber: null,
  bodyOriginal: 'POS la pa mache. Kliyan yo pa ka depoze lajan.',
  bodyTranslated: 'The POS is not working. Customers cannot deposit money.',
  language: 'ht',
  confidence: 0.95,
  translationProvider: 'mock',
  rawPayload: null,
  createdAt: new Date(),
  ticketId: inboundTicket.id,
  agentId: agent.id
};

const patchedTicket = {
  ...inboundTicket,
  status: TicketStatus.IN_PROGRESS,
  severity: Severity.HIGH,
  agent,
  messages: [inboundMessage]
};

const outboundMessage = {
  id: 'message-2',
  direction: MessageDirection.OUTBOUND,
  channel: 'whatsapp',
  fromNumber: null,
  toNumber: agent.phoneNumber,
  bodyOriginal: 'We are checking the deposit issue now.',
  bodyTranslated: '[Kreyòl translation] We are checking the deposit issue now.',
  language: 'ht',
  confidence: 0.8,
  translationProvider: 'mock',
  rawPayload: {
    sent: false,
    providerResponse: {
      demo: true,
      to: agent.phoneNumber,
      body: '[Kreyòl translation] We are checking the deposit issue now.'
    }
  },
  createdAt: new Date(),
  ticketId: inboundTicket.id,
  agentId: agent.id
};

const prismaMock = vi.hoisted(() => ({
  agent: {
    upsert: vi.fn()
  },
  ticket: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  message: {
    create: vi.fn()
  }
}));

vi.mock('../src/prisma', () => ({ prisma: prismaMock }));

async function request(server: http.Server, path: string, options: RequestInit = {}) {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server is not listening');
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
}

describe('ticket routes', () => {
  let server: http.Server;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createApp } = await import('../src/app');
    server = http.createServer(createApp({ emit } as any));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it('creates a translated ticket from a token-protected simulated inbound message', async () => {
    prismaMock.agent.upsert.mockResolvedValue(agent);
    prismaMock.ticket.findFirst.mockResolvedValue(null);
    prismaMock.ticket.create.mockResolvedValue(inboundTicket);
    prismaMock.message.create.mockResolvedValue(inboundMessage);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...inboundTicket, agent, messages: [inboundMessage] });

    const response = await request(server, '/dev/simulate-inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dashboard-access-token': 'test-token'
      },
      body: JSON.stringify({
        from: agent.phoneNumber,
        text: inboundMessage.bodyOriginal,
        name: agent.displayName,
        branchId: agent.branchId,
        region: agent.region
      })
    });

    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.ticket.messages[0].bodyOriginal).toBe(inboundMessage.bodyOriginal);
    expect(body.ticket.messages[0].bodyTranslated).toBe(inboundMessage.bodyTranslated);
    expect(emit).toHaveBeenCalledWith('ticket:update', expect.objectContaining({ id: body.ticket.id }));
  });

  it('updates ticket triage fields through the protected ticket endpoint', async () => {
    prismaMock.ticket.update.mockResolvedValue(patchedTicket);

    const response = await request(server, '/api/tickets/ticket-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-dashboard-access-token': 'test-token'
      },
      body: JSON.stringify({ status: TicketStatus.IN_PROGRESS, severity: Severity.HIGH })
    });

    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.ticket.status).toBe(TicketStatus.IN_PROGRESS);
    expect(body.ticket.severity).toBe(Severity.HIGH);
    expect(prismaMock.ticket.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ticket-1' },
      data: { status: TicketStatus.IN_PROGRESS, severity: Severity.HIGH }
    }));
    expect(emit).toHaveBeenCalledWith('ticket:update', patchedTicket);
  });

  it('stores outbound replies in demo mode without real WhatsApp credentials', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ ...inboundTicket, agent });
    prismaMock.message.create.mockResolvedValue(outboundMessage);
    prismaMock.ticket.update.mockResolvedValue({ ...inboundTicket, status: TicketStatus.WAITING_ON_AGENT });

    const response = await request(server, '/api/tickets/ticket-1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dashboard-access-token': 'test-token'
      },
      body: JSON.stringify({ body: outboundMessage.bodyOriginal })
    });

    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.sendResult.sent).toBe(false);
    expect(body.sendResult.providerResponse.demo).toBe(true);
    expect(body.message.bodyOriginal).toBe(outboundMessage.bodyOriginal);
    expect(body.message.bodyTranslated).toContain('[Kreyòl translation]');
    expect(prismaMock.ticket.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ticket-1' },
      data: expect.objectContaining({ status: TicketStatus.WAITING_ON_AGENT })
    }));
    expect(emit).toHaveBeenCalledWith('message:new', outboundMessage);
  });
});
