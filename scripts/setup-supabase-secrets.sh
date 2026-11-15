#!/usr/bin/env bash
# Configura secrets en Supabase tras clonar el repo (ejecutar manualmente).
set -euo pipefail

PROJECT_REF="${PROJECT_REF:?Define PROJECT_REF (ref del proyecto Supabase)}"

if [ -z "${ORDER_WORKER_SECRET:-}" ] || [ -z "${SENDER_EMAIL:-}" ] || [ -z "${BREVO_API_KEY:-}" ]; then
  echo "Define: ORDER_WORKER_SECRET, SENDER_EMAIL, BREVO_API_KEY"
  exit 1
fi

npx supabase secrets set --project-ref "$PROJECT_REF" \
  ORDER_WORKER_SECRET="$ORDER_WORKER_SECRET" \
  SENDER_EMAIL="$SENDER_EMAIL" \
  BREVO_API_KEY="$BREVO_API_KEY" \
  ${DEMO_TRUCK_ID:+DEMO_TRUCK_ID="$DEMO_TRUCK_ID"} \
  ${FLEET_TRACKING_URL:+FLEET_TRACKING_URL="$FLEET_TRACKING_URL"}

npx supabase functions deploy order-worker --project-ref "$PROJECT_REF" --no-verify-jwt
npx supabase functions deploy telemetry-ingest --project-ref "$PROJECT_REF" --no-verify-jwt
npx supabase db push --linked

echo "Recuerda crear los secrets en Vault (SQL Editor):"
echo "SELECT vault.create_secret('$ORDER_WORKER_SECRET', 'ORDER_WORKER_SECRET', 'API key del order-worker');"
echo "SELECT vault.create_secret('https://$PROJECT_REF.supabase.co/functions/v1/order-worker', 'ORDER_WORKER_URL', 'URL del order-worker');"
