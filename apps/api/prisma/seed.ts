import { PrismaClient, MessageDirection, Severity, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const agent = await prisma.agent.upsert({
    where: { phoneNumber: '50937000001' },
    update: {},
    create: {
      phoneNumber: '50937000001',
      displayName: 'Mireille Jean',
      branchId: 'PAP-042',
      region: 'Port-au-Prince',
      preferredLanguage: 'ht'
    }
  });

  const existing = await prisma.ticket.findFirst({ where: { shortCode: 'HT-1001' } });
  if (!existing) {
    const ticket = await prisma.ticket.create({
      data: {
        shortCode: 'HT-1001',
        agentId: agent.id,
        status: TicketStatus.OPEN,
        severity: Severity.HIGH,
        category: 'transaction_failure',
        issueKey: 'transaction_failure:withdrawal',
        title: 'Withdrawal confirmation failing at PAP-042',
        summary: 'Agent reports the app closes when confirming a customer withdrawal.',
        language: 'ht',
        branchId: 'PAP-042',
        region: 'Port-au-Prince'
      }
    });

    await prisma.message.create({
      data: {
        ticketId: ticket.id,
        agentId: agent.id,
        direction: MessageDirection.INBOUND,
        fromNumber: agent.phoneNumber,
        bodyOriginal: 'App la fèmen chak fwa mwen eseye konfime retrè a pou kliyan an.',
        bodyTranslated: 'The app closes every time I try to confirm the customer withdrawal.',
        language: 'ht',
        confidence: 0.74,
        translationProvider: 'mock'
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
