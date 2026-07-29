#!/usr/bin/env bash
# Configura secrets en Supabase tras clonar el repo (ejecutar manualmente).
set -euo pipefail

PROJECT_REF="yiarfffsaciuodbplxus"

if [ -z "${PROCESS_ORDER_SECRET:-}" ] || [ -z "${TELEMETRY_INGEST_SECRET:-}" ] || [ -z "${SENDER_EMAIL:-}" ] || [ -z "${BREVO_API_KEY:-}" ]; then
  echo "Define: PROCESS_ORDER_SECRET, TELEMETRY_INGEST_SECRET, SENDER_EMAIL, BREVO_API_KEY"
  exit 1
fi

npx supabase secrets set --project-ref "$PROJECT_REF" \
  PROCESS_ORDER_SECRET="$PROCESS_ORDER_SECRET" \
  TELEMETRY_INGEST_SECRET="$TELEMETRY_INGEST_SECRET" \
  SENDER_EMAIL="$SENDER_EMAIL" \
  BREVO_API_KEY="$BREVO_API_KEY" \
  ${FLEET_TRACKING_URL:+FLEET_TRACKING_URL="$FLEET_TRACKING_URL"}

npx supabase functions deploy process-order --project-ref "$PROJECT_REF" --no-verify-jwt
npx supabase functions deploy telemetry-ingest --project-ref "$PROJECT_REF" --no-verify-jwt
npx supabase db query --linked -f supabase/migrations/20260729120000_secure_process_order_trigger.sql

echo "Recuerda crear el secret en Vault (SQL Editor):"
echo "SELECT vault.create_secret('$PROCESS_ORDER_SECRET', 'PROCESS_ORDER_SECRET', 'Trigger pg_net');"
