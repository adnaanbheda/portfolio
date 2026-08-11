#!/usr/bin/env bash
# Cron-driven deploy for the Pi runner. Replaces the old self-hosted GitHub
# Actions job: this script pulls, builds, syncs, reloads nginx, and purges
# Cloudflare cache. Run via crontab, e.g.:
#   */2 * * * * /home/adnaan/portfolio-adnaan/deploy.sh >> /home/adnaan/deploy.log 2>&1
set -euo pipefail

REPO_DIR="/home/adnaan/portfolio-adnaan"
WEBROOT="/home/adnaan/sites/provision/portfolio-adnaan/html/"
NGINX_CONF="/etc/nginx/conf.d/portfolio-adnaan.conf"
ENV_FILE="/home/adnaan/sites/provision/portfolio-adnaan/.env"
LOCK_FILE="/tmp/portfolio-adnaan-deploy.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Deploy already running, skipping this tick."
  exit 0
fi

cd "$REPO_DIR"

git fetch origin main
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  exit 0
fi

echo "$(date -Iseconds) deploying $LOCAL_SHA -> $REMOTE_SHA"
git reset --hard origin/main

npm ci
npm run build

rsync -a --delete dist/ "$WEBROOT"

sudo cp nginx.conf "$NGINX_CONF"
sudo nginx -t
sudo systemctl reload nginx

# Purge Cloudflare cache for the HTML shell. /assets/* is content-hashed and
# cached immutably - never needs purging. Skips quietly if the env file or
# secrets are missing, so a fresh checkout can't break the deploy.
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ]; then
  curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"files":["https://portfolio.adnaan.me/","https://portfolio.adnaan.me/index.html"]}'
else
  echo "CF_API_TOKEN/CF_ZONE_ID not set - skipping purge."
fi

# Nothing else verifies the deploy actually left the site in a working
# state - a bad build, a bad rsync, or an nginx reload failure would
# otherwise go unnoticed. Hits nginx directly, unaffected by DNS/Cloudflare.
curl -sf http://localhost:5173/ > /dev/null

echo "$(date -Iseconds) deploy done at $REMOTE_SHA"
