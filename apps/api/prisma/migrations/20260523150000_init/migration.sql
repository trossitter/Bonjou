-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_AGENT', 'RESOLVED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "branchId" TEXT,
    "region" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'ht',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "issueKey" TEXT NOT NULL DEFAULT 'general',
    "sourceChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    "language" TEXT NOT NULL DEFAULT 'unknown',
    "branchId" TEXT,
    "region" TEXT,
    "assignedTo" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "bodyOriginal" TEXT NOT NULL,
    "bodyTranslated" TEXT,
    "language" TEXT NOT NULL DEFAULT 'unknown',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "translationProvider" TEXT NOT NULL DEFAULT 'mock',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" TEXT NOT NULL,
    "agentId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_phoneNumber_key" ON "Agent"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_shortCode_key" ON "Ticket"("shortCode");

-- CreateIndex
CREATE INDEX "Ticket_status_severity_idx" ON "Ticket"("status", "severity");

-- CreateIndex
CREATE INDEX "Ticket_issueKey_createdAt_idx" ON "Ticket"("issueKey", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_branchId_idx" ON "Ticket"("branchId");

-- CreateIndex
CREATE INDEX "Message_ticketId_createdAt_idx" ON "Message"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
