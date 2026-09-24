#!/usr/bin/env bash
# Push apps/web/.env.local keys to Vercel Production (and Preview).
# Usage:
#   vercel login
#   ./scripts/push-vercel-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/web/.env.local"
WEB_DIR="$ROOT/apps/web"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel"
  exit 1
fi

cd "$WEB_DIR"

KEYS=(
  DATABASE_URL
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET
  R2_PUBLIC_BASE_URL
  OPERATOR_PIN
  AGENT_TOKEN
  DISPLAY_DURATION_MS
  DISPLAY_FADE_MS
  FWF_OUTPUT_WIDTH
  FWF_OUTPUT_HEIGHT
)

get_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2-
}

for key in "${KEYS[@]}"; do
  val="$(get_val "$key" || true)"
  if [[ -z "${val:-}" ]]; then
    echo "Skip empty: $key"
    continue
  fi
  echo "→ $key (production + preview)"
  printf '%s' "$val" | vercel env add "$key" production --force >/dev/null
  printf '%s' "$val" | vercel env add "$key" preview --force >/dev/null
done

echo "Done. Trigger redeploy:"
echo "  vercel --prod --yes"
