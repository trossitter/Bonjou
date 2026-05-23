# Bonjou deployment guide

Designed by Thalia.

This guide is intentionally blunt. Follow the commands in order.

## Local demo in 3 minutes

### 1. Install prerequisites

You need Docker Desktop.

### 2. Start the app

```bash
cp .env.example .env
docker compose up --build
```

### 3. Open the dashboard

```text
http://localhost:3000
```

### 4. Create a test ticket

```bash
curl -X POST http://localhost:3000/dev/simulate-inbound \
  -H 'Content-Type: application/json' \
  -d '{"from":"50937000001","text":"Mwen pa ka konekte. Login lan pa mache depi maten an.","name":"Jean","branchId":"PAP-014","region":"Port-au-Prince"}'
```

Refresh or watch the dashboard. The ticket should appear.

## Local developer mode

Use this only if you want hot reload.

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:generate
npm run db:dev
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:5173
```

## Railway deployment

### 1. Install Railway CLI

```bash
npm install -g @railway/cli
```

### 2. Log in

```bash
railway login
```

### 3. Create a project

```bash
railway init
```

### 4. Add Postgres

```bash
railway add --database postgres
```

### 5. Add environment variables

Start with demo mode:

```bash
railway variables set NODE_ENV=production
railway variables set WHATSAPP_ENABLED=false
railway variables set WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 24)
railway variables set TRANSLATION_PROVIDER=mock
```

For real WhatsApp:

```bash
railway variables set WHATSAPP_ENABLED=true
railway variables set WHATSAPP_ACCESS_TOKEN='<META_ACCESS_TOKEN>'
railway variables set WHATSAPP_PHONE_NUMBER_ID='<META_PHONE_NUMBER_ID>'
railway variables set WHATSAPP_GRAPH_VERSION='v21.0'
```

For OpenAI translation:

```bash
railway variables set TRANSLATION_PROVIDER=openai
railway variables set OPENAI_API_KEY='<OPENAI_API_KEY>'
railway variables set OPENAI_MODEL='gpt-4.1-mini'
```

### 6. Deploy

```bash
railway up
```

### 7. Get the public URL

```bash
railway domain
```

### 8. Configure Meta webhook

In the Meta app dashboard:

```text
Callback URL: https://YOUR-RAILWAY-DOMAIN/webhooks/whatsapp
Verify token: the same value as WHATSAPP_VERIFY_TOKEN
Webhook field: messages
```

### 9. Smoke test the deployment

```bash
curl https://YOUR-RAILWAY-DOMAIN/health
```

Expected result:

```json
{"ok":true}
```

Create a simulated inbound message:

```bash
curl -X POST https://YOUR-RAILWAY-DOMAIN/dev/simulate-inbound \
  -H 'Content-Type: application/json' \
  -d '{"from":"50937000002","text":"POS la pa mache. Kliyan yo pa ka depoze lajan.","name":"Nadia","branchId":"CAP-003","region":"Cap-Haïtien"}'
```

## What to do if it breaks

### Dashboard loads but no tickets appear

Run:

```bash
railway logs
```

Check that `DATABASE_URL` exists. Railway should inject it after adding Postgres.

### Meta webhook verification fails

Check these match exactly:

```bash
railway variables | grep WHATSAPP_VERIFY_TOKEN
```

Then compare that value to the token entered in Meta.

### Outbound WhatsApp replies fail

Check:

```bash
railway variables | grep WHATSAPP
```

You need all of these:

```text
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```

### Translation looks fake

That means you are still in mock mode. Set:

```bash
railway variables set TRANSLATION_PROVIDER=openai
railway variables set OPENAI_API_KEY='<OPENAI_API_KEY>'
```

Redeploy:

```bash
railway up
```

## Demo script

1. Show the dashboard.
2. Send the simulated Kreyòl issue using curl.
3. Show the new ticket appearing.
4. Point out original message + English translation.
5. Change severity from Medium to High.
6. Reply in English.
7. Explain that production sends the translated reply back through WhatsApp.
8. Open the code and show `/webhooks/whatsapp`.
9. Open the deployment guide and show that a non-expert can run it.

## Production hardening checklist

Do these after the demo:

- Add real authentication and roles.
- Add PII redaction before translation.
- Add structured branch/agent import.
- Add translation review workflow.
- Add incident clustering dashboard.
- Add webhook signature validation and Meta app secret proof.
- Add rate limits and abuse controls.
- Add error monitoring.
- Add backups and retention policy.
