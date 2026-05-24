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
- DigitalOcean Droplet deployment with Docker Compose

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

## Deploy on a DigitalOcean Droplet

Bonjou is Docker-first and defaults to demo-safe settings: WhatsApp disabled, mock translation enabled, and no paid runtime AI required.
Production demo deployments should set `DASHBOARD_ACCESS_TOKEN` so the shared inbox and demo endpoints are not open to the public internet.

Use the Droplet guide:

```text
docs/DROPLET_DEPLOYMENT.md
```

Short version on the Droplet:

```bash
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Real WhatsApp setup

Demo mode does not require Meta credentials. If you later connect real WhatsApp, configure the empty `WHATSAPP_*` values only in your server environment and never commit them.

1. Create a Meta app with WhatsApp Business Platform enabled.
2. Set `WHATSAPP_ENABLED=true` on the server.
3. In Meta, set the webhook callback URL:

```text
https://YOUR_DOMAIN/webhooks/whatsapp
```

4. Set the verify token to the same value as `WHATSAPP_VERIFY_TOKEN`.
5. Subscribe to `messages` webhook events.
6. Send a WhatsApp test message to the business number.

## Translation providers

`TRANSLATION_PROVIDER=mock` works immediately for demo.

`TRANSLATION_PROVIDER=openai` will use `OPENAI_API_KEY` and `OPENAI_MODEL` if configured. The app falls back to mock translation if the provider fails so the demo does not break.
