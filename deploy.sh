#!/usr/bin/env bash
# Cron-driven deploy for the Pi runner. Replaces the old self-hosted GitHub
# Actions job: this script pulls, builds, syncs, reloads nginx, purges
# Cloudflare cache, and posts a Discord notification on success/failure.
# Run via crontab, e.g.:
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

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

# Body goes to python3 over stdin and comes back as a JSON-escaped Discord
# payload - avoids hand-escaping quotes/backticks/newlines from commit
# messages or $BASH_COMMAND into a hand-rolled JSON string.
notify() {
  [ -n "${DISCORD_WEBHOOK_URL:-}" ] || return 0
  local payload
  payload="$(printf '%s' "$1" | python3 -c '
import json, sys
print(json.dumps({"content": sys.stdin.read()}))
')"
  curl -sf -X POST -H "Content-Type: application/json" -d "$payload" "$DISCORD_WEBHOOK_URL" >/dev/null || true
}

# set -e turns any failing command below into an ERR trap; the no-op exit
# above is deliberate (exit 0), so a normal "nothing changed" tick never
# triggers it.
trap 'notify "⚠️ portfolio-adnaan deploy FAILED at line $LINENO: \`$BASH_COMMAND\`"' ERR

git fetch origin main
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  exit 0
fi

# Always sync the checkout so this script and nginx.conf stay current even
# on a skipped tick below - otherwise a deploy-relevant commit landing on
# top of a skipped one would diff against a stale LOCAL_SHA next time.
git reset --hard origin/main

# Skip the heavy pipeline (build/rsync/nginx/purge/notify) for commits that
# don't touch anything that affects the deployed site - docs, agent/tooling
# config, CI-only files, etc.
if ! git diff --name-only "$LOCAL_SHA" "$REMOTE_SHA" | grep -qE '^(src/|public/|package(-lock)?\.json|vite\.config\.js|nginx\.conf)'; then
  echo "$(date -Iseconds) $LOCAL_SHA -> $REMOTE_SHA has no deploy-relevant changes, skipping build."
  exit 0
fi

echo "$(date -Iseconds) deploying $LOCAL_SHA -> $REMOTE_SHA"

npm ci
npm run build

rsync -a --delete dist/ "$WEBROOT"

sudo cp nginx.conf "$NGINX_CONF"
sudo nginx -t
sudo systemctl reload nginx

# Purge Cloudflare cache for the HTML shell. /assets/* is content-hashed and
# cached immutably - never needs purging. Skips quietly if the env file or
# secrets are missing, so a fresh checkout can't break the deploy.
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

COMMITS="$(git log --pretty=format:'%h %s' "$LOCAL_SHA..$REMOTE_SHA")"
notify "$(printf '🚀 **Deployed** `%s` @ `%s`\n%s' "$(basename "$REPO_DIR")" "${REMOTE_SHA:0:7}" "${COMMITS:-(no commits listed)}")"
echo "$(date -Iseconds) deploy done at $REMOTE_SHA"
