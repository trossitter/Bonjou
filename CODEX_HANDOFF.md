# Bonjou — Codex Handoff

WhatsApp-native field ops inbox for Haiti. Field agents send informal messages over WhatsApp in Kreyòl / French / Spanish. Bonjou ingests, detects language, translates, classifies severity, and surfaces actionable tickets to a US ops team in real time.

**Live demo:** http://64.225.21.75 (no auth, open)  
**GitHub:** https://github.com/trossitter/Bonjou

---

## Stack

| Layer | Tech |
|---|---|
| API | Node.js + Express + Socket.IO |
| DB | PostgreSQL via Prisma ORM |
| Frontend | React 18 + Vite + TypeScript |
| Deploy | Docker Compose on DigitalOcean droplet |
| Translation | Claude Haiku (`claude-haiku-4-5-20251001`) or mock |

Monorepo: `apps/api/` and `apps/web/`. Root `package.json` uses npm workspaces.

---

## Local dev

```bash
cp .env.example .env          # edit DATABASE_URL, optionally ANTHROPIC_API_KEY
npm install
docker compose up -d          # starts postgres + app on :3000
# OR run separately:
npm run dev                   # api on :3000, web on :5173 (Vite proxies /api /dev /webhooks → :3000)
```

Vite proxy config: `apps/web/vite.config.ts` — `/api`, `/dev`, `/webhooks` forward to `localhost:3000`.

---

## Key env vars (`apps/api/src/env.ts`)

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Required |
| `TRANSLATION_PROVIDER` | `mock` | Set to `claude` for real translation |
| `ANTHROPIC_API_KEY` | — | Required when provider is `claude` |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | |
| `DASHBOARD_ACCESS_TOKEN` | `""` | Empty = no auth (current demo state) |
| `WHATSAPP_ENABLED` | `false` | Set `true` + Meta credentials for live WA |
| `SEED_DEMO_DATA` | `false` | Inserts one sample ticket on startup |

**Critical gotcha:** `dotenv.config({ override: true })` is required in `env.ts`. Without `override: true`, an existing `ANTHROPIC_API_KEY` in the shell environment (e.g. Claude Code's own key) will shadow the `.env` value and you'll get 401 errors.

---

## API routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/tickets` | List tickets (newest first, limit 100) |
| `GET` | `/api/tickets/:id` | Single ticket |
| `PATCH` | `/api/tickets/:id` | Update status / severity / summary |
| `POST` | `/api/tickets/:id/messages` | Send outbound reply (auto-translates) |
| `POST` | `/webhooks/whatsapp` | Meta Cloud API webhook (live WA) |
| `GET` | `/webhooks/whatsapp` | Webhook verify challenge |
| `POST` | `/dev/simulate-inbound` | Inject a fake inbound message (dev only) |

Auth middleware (`apps/api/src/middleware/dashboardAccess.ts`): checks `x-dashboard-access-token` header. Passes through if `DASHBOARD_ACCESS_TOKEN` is empty.

---

## Services

### `apps/api/src/services/language.ts`
Detects language from text. Supports `ht` (Kreyòl), `fr`, `es`, `en`. Uses weighted keyword scoring with **Levenshtein fuzzy matching** (1-edit tolerance for words ≥5 chars) to handle common keyboard misspellings from field agents.

### `apps/api/src/services/classifier.ts`
Rule-based regex classifier. Returns `{ severity, category, issueKey, title, summary }`. Categories: `payout_failure` (CRITICAL), `transaction_failure` (CRITICAL), `betting_ops` (CRITICAL), `app_crash` (HIGH), `login_access` (HIGH), `odds_results` (HIGH), `connectivity` (MEDIUM), `operations_complaint` (LOW), `general` (MEDIUM fallback).

### `apps/api/src/services/translation.ts`
Provider pattern: `mock` (brackets placeholder), `claude` (Haiku via Anthropic SDK). The system prompt is tuned for operational field messages — preserves branch IDs, transaction amounts, and urgency signals.

### `apps/api/src/services/whatsapp.ts`
Wraps Meta Graph API. Only active when `WHATSAPP_ENABLED=true`. Safe to ignore for demo work.

---

## Frontend (`apps/web/src/main.tsx` + `styles.css`)

Single-file React app (~540 lines). No component library, no Tailwind — plain CSS in `styles.css`.

**Key UI features:**
- **5 metric cards** at top — clickable, each filters the ticket list and scrolls to workspace. Keys: `open`, `critical`, `resolved` (MTTR), `closed_today`, `patterns` (groups by issueKey).
- **Haiti SVG map** — 6 city dots (PAP, CAP, GON, CAY, JAC, PDP), pulse animation on active branches, click for popover showing open/total/today counts.
- **Ticket list** — sort pills (Severity default, Newest, Oldest), status + severity dropdowns, text search.
- **Conversation view** — original message + gold-ruled translation, outbound reply textarea.
- **Severity pill picker** — replaces dropdown; labeled "AI classified · confirm or adjust". CRITICAL / HIGH / MEDIUM / LOW pills, active one has gold ring.
- **Close ticket / Reopen** button — sets status to RESOLVED / OPEN.
- **Language chips** — styled dark pill showing full name (Kreyòl, Français, Español, English). No emoji.
- **Simulate button** — cycles through 7 demo scenarios (WhatsApp green, top-right).

**DEMO_SCENARIOS** (7 entries): rotates through PAP, CAY, CAP, JAC, GON branches. Mix of Kreyòl (with deliberate misspellings), French, Spanish. Covers payout blocks, system offline during match, odds not updating, double-charge, suspended account, wrong results.

**CITY_COORDS**: `PAP {x:278,y:190}`, `CAP {x:296,y:52}`, `GON {x:233,y:82}`, `CAY {x:100,y:232}`, `JAC {x:252,y:218}`, `PDP {x:212,y:32}` — SVG viewBox `0 0 390 270`.

**LANG_META**: `{ ht: 'Kreyòl', fr: 'Français', es: 'Español', en: 'English', unknown: 'Unknown' }`.

**Accent color**: `#c9920a` (Haitian ironwork gold). Flag blue/red gradient in topbar: `linear-gradient(135deg, #062a78, #d71920)`.

---

## Production (droplet)

- IP: `64.225.21.75`, port 80 (Docker maps 80 → container 3000)
- SSH: `ssh -i ~/.ssh/bonjou_droplet root@64.225.21.75`
- App root: `/opt/bonjou/`
- Deploy: `cd /opt/bonjou && git pull origin main && sh scripts/deploy-droplet.sh`
- The deploy script uses `.env.production` + `docker-compose.prod.yml`

**Current production state:**
- `TRANSLATION_PROVIDER=mock` — outbound replies show `[Kreyòl translation]` placeholder
- To enable real translation: add `ANTHROPIC_API_KEY=<key>` and `TRANSLATION_PROVIDER=claude` to `/opt/bonjou/.env.production`, then redeploy
- `DASHBOARD_ACCESS_TOKEN=` (empty) — no auth gate
- `WHATSAPP_ENABLED=false` — simulate button only, no live WhatsApp

---

## What's not built yet

- **Real WhatsApp integration** — webhook is wired but Meta credentials not configured. `WHATSAPP_ENABLED=false`.
- **Real Claude translation on droplet** — mock only. Add `ANTHROPIC_API_KEY` to unblock.
- **Agent management UI** — no way to create/edit agents from the dashboard; agents are created implicitly when a message arrives from a new phone number.
- **Assignment / on-call routing** — `assignedTo` field exists on the ticket model but nothing sets or displays it.
- **Ticket history / audit log** — status changes aren't timestamped beyond `updatedAt`.
- **Analytics view** — MTTR and closed-today are computed client-side from the ticket list; no persistent aggregation.
