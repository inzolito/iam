#!/usr/bin/env bash
# Script para ejecutar la app contra el backend de staging
#
# Uso:
#   ./scripts/run_staging.sh
#
# Requiere un archivo .env.staging en la raíz de apps/mobile con las credenciales.

set -e

ENV_FILE=".env.staging"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Falta $ENV_FILE en $(pwd)"
  exit 1
fi

export $(grep -v '^#' "$ENV_FILE" | xargs)

echo "🧪 Corriendo IAM Mobile contra STAGING..."
echo "   SUPABASE_URL=$SUPABASE_URL"
echo "   API_BASE_URL=${API_BASE_URL:-$SUPABASE_URL/functions/v1}"

flutter run \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=API_BASE_URL="${API_BASE_URL:-}" \
  --dart-define=ENV=staging
