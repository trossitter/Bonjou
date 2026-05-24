#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: scripts/bootstrap-droplet.sh YOUR_DROPLET_IP"
  exit 1
fi

DROPLET_IP="$1"
REPO_URL="${REPO_URL:-https://github.com/trossitter/Bonjou.git}"
APP_DIR="${APP_DIR:-/opt/bonjou}"

ssh "root@${DROPLET_IP}" \
  "REPO_URL='${REPO_URL}' APP_DIR='${APP_DIR}' bash -s" <<'REMOTE'
set -euo pipefail

apt-get update
apt-get install -y ca-certificates curl gnupg git ufw openssl

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

mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  DB_PASSWORD="$(openssl rand -hex 24)"
  VERIFY_TOKEN="$(openssl rand -hex 24)"
  DASHBOARD_TOKEN="$(openssl rand -hex 24)"

  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASSWORD}|" .env.production
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/bonjou?schema=public|" .env.production
  sed -i "s|^WHATSAPP_VERIFY_TOKEN=.*|WHATSAPP_VERIFY_TOKEN=${VERIFY_TOKEN}|" .env.production
  sed -i "s|^DASHBOARD_ACCESS_TOKEN=.*|DASHBOARD_ACCESS_TOKEN=${DASHBOARD_TOKEN}|" .env.production
fi

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
REMOTE

echo "Bonjou bootstrap finished. Open http://${DROPLET_IP}"
