#!/usr/bin/env bash
# Script para ejecutar la app en modo desarrollo (backend local)
#
# Uso:
#   ./scripts/run_dev.sh
#
# Requiere un archivo .env.dev en la raíz de apps/mobile con:
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_ANON_KEY=tu-local-anon-key
#   API_BASE_URL=http://10.0.2.2:3000  # Android emulator → host
#                                       # Use localhost:3000 en iOS simulator

set -e

ENV_FILE=".env.dev"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Falta $ENV_FILE en $(pwd)"
  echo "   Crea uno con SUPABASE_URL, SUPABASE_ANON_KEY y API_BASE_URL"
  exit 1
fi

# Cargar variables del .env.dev
export $(grep -v '^#' "$ENV_FILE" | xargs)

echo "🚀 Corriendo IAM Mobile en DEV..."
echo "   SUPABASE_URL=$SUPABASE_URL"
echo "   API_BASE_URL=${API_BASE_URL:-$SUPABASE_URL/functions/v1}"

flutter run \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=API_BASE_URL="${API_BASE_URL:-}" \
  --dart-define=ENV=dev
