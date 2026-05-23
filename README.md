# Bonjou

**Bonjou** is a WhatsApp-native field operations inbox for Haiti. It turns informal WhatsApp messages from branch agents into translated, triaged, searchable tickets for US operations and engineering teams.

Designed by Thalia.

## What is in the MVP

- WhatsApp Cloud API webhook verification and inbound text ingestion
- Outbound WhatsApp replies from the dashboard
- Real-time shared inbox dashboard
- Haitian Creole / French / Spanish / English language detection and translation abstraction
- Ticket creation, severity classification, and issue clustering hints
- PostgreSQL persistence with Prisma
- Socket.IO real-time updates
- Docker Compose local deployment
- Railway-ready Dockerfile

## Explicitly out of scope for this MVP

- Audio ingestion / voice notes
- Native mobile app
- Full production auth / RBAC
- Perfect translation quality
- Payment transaction processing

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open: <http://localhost:3000>

Send a simulated inbound WhatsApp message:

```bash
curl -X POST http://localhost:3000/dev/simulate-inbound \
  -H 'Content-Type: application/json' \
  -d '{"from":"50937000001","text":"App la fèmen chak fwa mwen eseye fè retrè pou kliyan an","name":"Mireille","branchId":"PAP-042","region":"Port-au-Prince"}'
```

The ticket should appear in the dashboard immediately.

## Real WhatsApp setup

1. Create a Meta app with WhatsApp Business Platform enabled.
2. Copy `.env.example` to `.env`.
3. Set:

```bash
WHATSAPP_ENABLED=true
WHATSAPP_VERIFY_TOKEN=<make-up-a-secret-token>
WHATSAPP_ACCESS_TOKEN=<meta-permanent-or-temporary-token>
WHATSAPP_PHONE_NUMBER_ID=<meta-phone-number-id>
```

4. In Meta, set the webhook callback URL:

```text
https://YOUR_DOMAIN/webhooks/whatsapp
```

5. Set the verify token to the same value as `WHATSAPP_VERIFY_TOKEN`.
6. Subscribe to `messages` webhook events.
7. Send a WhatsApp test message to the business number.

## Translation providers

`TRANSLATION_PROVIDER=mock` works immediately for demo.

`TRANSLATION_PROVIDER=openai` will use `OPENAI_API_KEY` and `OPENAI_MODEL` if configured. The app falls back to mock translation if the provider fails so the demo does not break.
