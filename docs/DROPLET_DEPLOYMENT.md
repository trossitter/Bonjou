# Bonjou Droplet Deployment

Designed by Thalia.

This is the simple path for running Bonjou on a small DigitalOcean Droplet with Docker Compose. The demo starts with WhatsApp disabled and mock translation enabled, so you do not need Meta, OpenAI, Railway, Vercel, or any managed app platform.

## What You Will Run

- One Bonjou app container
- One Postgres container
- A persistent Docker volume for the database
- Port `80` on the Droplet mapped to the app on port `3000`

## 1. Create Or Use A Droplet

Use an Ubuntu 24.04 Droplet. A $20-ish size is enough for the demo. If `s-2vcpu-2gb` is not the right slug in your account, choose the closest slug from the size list.

Optional `doctl` path from your laptop:

```bash
brew install doctl
doctl auth init

doctl compute size list --format Slug,Memory,VCPUs,Disk,PriceMonthly
doctl compute image list-distribution --format Slug,Name

doctl compute ssh-key list

doctl compute droplet create bonjou-demo \
  --region nyc3 \
  --size s-2vcpu-2gb \
  --image ubuntu-24-04-x64 \
  --ssh-keys YOUR_SSH_KEY_ID \
  --tag-names bonjou,demo \
  --wait

doctl compute droplet list --format ID,Name,PublicIPv4,Status
```

## 2. SSH Into The Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

If the DigitalOcean web console feels slow, do not use it. Use your normal local terminal and SSH. After the Droplet exists, you can also run the helper from your laptop:

```bash
scripts/bootstrap-droplet.sh YOUR_DROPLET_IP
```

That helper installs Docker, clones Bonjou into `/opt/bonjou`, creates `.env.production` with generated demo-safe values, starts the app, and does not need any DigitalOcean token. If you use the helper, fetch your demo access token with:

```bash
ssh root@YOUR_DROPLET_IP "grep '^DASHBOARD_ACCESS_TOKEN=' /opt/bonjou/.env.production"
```

Keep that token private. Share it only with people who should see the pilot. If you use the helper, skip to the smoke tests below.

## 3. Install Docker And Basic Tools

Run this on the Droplet:

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg git ufw

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 4. Clone Bonjou

Run this on the Droplet:

```bash
mkdir -p /opt/bonjou
cd /opt/bonjou

git clone https://github.com/trossitter/Bonjou.git .
cp .env.production.example .env.production
```

## 5. Create Random Values

Run these on the Droplet:

```bash
openssl rand -hex 24
openssl rand -hex 24
openssl rand -hex 24
```

Use one value for `POSTGRES_PASSWORD`, one for `WHATSAPP_VERIFY_TOKEN`, and one for `DASHBOARD_ACCESS_TOKEN`.

## 6. Edit Production Env

```bash
nano .env.production
```

Change these values:

```env
POSTGRES_PASSWORD=PASTE_ONE_RANDOM_VALUE_HERE
DATABASE_URL=postgresql://postgres:PASTE_THE_SAME_DB_PASSWORD_HERE@db:5432/bonjou?schema=public
WHATSAPP_VERIFY_TOKEN=PASTE_ANOTHER_RANDOM_VALUE_HERE
DASHBOARD_ACCESS_TOKEN=PASTE_ANOTHER_RANDOM_VALUE_HERE
```

Leave these as-is for the demo:

```env
WHATSAPP_ENABLED=false
TRANSLATION_PROVIDER=mock
SEED_DEMO_DATA=false
OPENAI_API_KEY=
```

Keep `DASHBOARD_ACCESS_TOKEN` private. It is the shared pilot token for ticket APIs, the dashboard data, and `/dev/simulate-inbound`.

## 7. Start The App

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

The app runs database migrations automatically when the app container starts. It does not seed demo data unless `SEED_DEMO_DATA=true`.

## 8. Smoke Test On The Droplet

In another SSH session, run:

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/dev/simulate-inbound \
  -H 'x-dashboard-access-token: YOUR_DASHBOARD_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"from":"50937000001","text":"POS la pa mache. Kliyan yo pa ka depoze lajan.","name":"Nadia","branchId":"PAP-003","region":"Port-au-Prince"}'
```

Expected health response:

```json
{"ok":true}
```

## 9. Smoke Test From Your Laptop

```bash
curl http://YOUR_DROPLET_IP/health

curl -X POST http://YOUR_DROPLET_IP/dev/simulate-inbound \
  -H 'x-dashboard-access-token: YOUR_DASHBOARD_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"from":"50937000001","text":"Mwen pa ka konekte. Login lan pa mache depi maten an.","name":"Jean","branchId":"PAP-014","region":"Port-au-Prince"}'
```

Open the dashboard:

```text
http://YOUR_DROPLET_IP
```

You should see the ticket, the original message, a mock English translation, status/severity controls, and a reply box. Replies work in demo mode without real WhatsApp credentials.

The dashboard asks for the same demo access token before loading ticket data.

## 10. Local Docker Demo

From your laptop:

```bash
git clone https://github.com/trossitter/Bonjou.git
cd Bonjou
cp .env.example .env
docker compose up --build
```

Then:

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/dev/simulate-inbound \
  -H 'Content-Type: application/json' \
  -d '{"from":"50937000001","text":"App la fèmen chak fwa mwen eseye fè retrè pou kliyan an","name":"Mireille","branchId":"PAP-042","region":"Port-au-Prince"}'
```

Open:

```text
http://localhost:3000
```

## 11. View Logs

```bash
cd /opt/bonjou
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

Only the app logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
```

Only the database logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f db
```

## 12. Restart Or Stop

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml restart
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

`down` stops containers but keeps the named Postgres volume.

## 13. Update From GitHub

```bash
cd /opt/bonjou
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

## Demo Mode Vs Real WhatsApp Mode

Demo mode:

```env
WHATSAPP_ENABLED=false
TRANSLATION_PROVIDER=mock
OPENAI_API_KEY=
DASHBOARD_ACCESS_TOKEN=YOUR_PRIVATE_DEMO_TOKEN
```

In demo mode, `/dev/simulate-inbound` creates tickets and outbound replies are saved with a demo provider response. No paid runtime AI is required.

This is intentionally a pilot demo, not a full platform handoff. Do not share `.env.production`, real branch data, implementation access, or partner-specific operating details with anyone who does not need them for the pilot.

Real WhatsApp mode is optional and should not block the demo. If you later enable it, set the WhatsApp values in `.env.production` on the server and restart. Do not commit those values.

Meta webhook target:

```text
http://YOUR_DROPLET_IP/webhooks/whatsapp
```

If you add HTTPS later, use:

```text
https://YOUR_DOMAIN/webhooks/whatsapp
```

The Meta verify token must exactly match `WHATSAPP_VERIFY_TOKEN`. Subscribe to WhatsApp `messages` events.

## Troubleshooting

### Health Check Fails

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
```

Look for database connection errors. Confirm `DATABASE_URL` uses `db` as the hostname, not `localhost`.

### Dashboard Or Simulate Endpoint Says Unauthorized

Use the token from `.env.production`:

```bash
grep '^DASHBOARD_ACCESS_TOKEN=' .env.production
```

For curl, include:

```bash
-H 'x-dashboard-access-token: YOUR_DASHBOARD_ACCESS_TOKEN'
```

### Database Will Not Start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f db
```

Confirm `POSTGRES_PASSWORD` is set in `.env.production`. If this is a brand-new demo and you intentionally want to erase the database, you can remove the named volume, but do not do that if you need to keep tickets.

### Webhook Verification Fails

Check that the token in Meta exactly matches:

```env
WHATSAPP_VERIFY_TOKEN=...
```

Then restart:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart app
```

### Outbound Replies Do Not Send To WhatsApp

For the demo, this is expected:

```env
WHATSAPP_ENABLED=false
```

The reply is still stored as an outbound message. Real sending requires WhatsApp mode to be enabled on the server with valid Meta values.

### Translation Looks Fake

That is expected in demo mode:

```env
TRANSLATION_PROVIDER=mock
```

Mock translation keeps the demo free and reliable. Real OpenAI translation is optional and should be configured only on the server if you choose to use it.

### The App Builds But The Dashboard Is Blank

Rebuild from scratch:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
```

Confirm the app container is serving on port `3000` and the Droplet firewall allows port `80`.
