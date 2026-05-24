# Bonjou Deployment

Designed by Thalia.

Bonjou is Docker-first. For the demo, deploy it on a DigitalOcean Droplet with Docker Compose.

Use the full guide:

```text
docs/DROPLET_DEPLOYMENT.md
```

Quick local demo:

```bash
cp .env.example .env
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Quick Droplet start after you have copied and edited `.env.production`:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

Default demo settings:

```env
WHATSAPP_ENABLED=false
TRANSLATION_PROVIDER=mock
SEED_DEMO_DATA=false
OPENAI_API_KEY=
DASHBOARD_ACCESS_TOKEN=CHANGE_ME_RANDOM_STRING
```

The dashboard shows `DASHBOARD_ACCESS_TOKEN` as the Bonjou demo password. It is not a GitHub token, OpenAI key, WhatsApp credential, or DigitalOcean token.

No Railway, Vercel, App Platform, OpenAI key, or Meta credential is required for the demo.
