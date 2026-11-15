# Configura secrets en Supabase (PowerShell). Ejecutar manualmente.
param(
  [Parameter(Mandatory = $true)][string]$OrderWorkerSecret,
  [Parameter(Mandatory = $true)][string]$SenderEmail,
  [Parameter(Mandatory = $true)][string]$BrevoApiKey,
  [string]$FleetTrackingUrl = "",
  [string]$DemoTruckId = "",
  [Parameter(Mandatory = $true)][string]$ProjectRef
)

$secrets = @(
  "ORDER_WORKER_SECRET=$OrderWorkerSecret",
  "SENDER_EMAIL=$SenderEmail",
  "BREVO_API_KEY=$BrevoApiKey"
)
if ($FleetTrackingUrl) { $secrets += "FLEET_TRACKING_URL=$FleetTrackingUrl" }
if ($DemoTruckId) { $secrets += "DEMO_TRUCK_ID=$DemoTruckId" }

npx supabase secrets set --project-ref $ProjectRef @secrets
npx supabase functions deploy order-worker --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy telemetry-ingest --project-ref $ProjectRef --no-verify-jwt
npx supabase db push --linked

Write-Host "Ejecuta en SQL Editor de Supabase:"
Write-Host "SELECT vault.create_secret('$OrderWorkerSecret', 'ORDER_WORKER_SECRET', 'API key del order-worker');"
Write-Host "SELECT vault.create_secret('https://$ProjectRef.supabase.co/functions/v1/order-worker', 'ORDER_WORKER_URL', 'URL del order-worker');"
