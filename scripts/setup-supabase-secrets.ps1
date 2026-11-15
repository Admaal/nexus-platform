# Configura secrets en Supabase (PowerShell). Ejecutar manualmente.
param(
  [Parameter(Mandatory = $true)][string]$ProcessOrderSecret,
  [Parameter(Mandatory = $true)][string]$TelemetryIngestSecret,
  [Parameter(Mandatory = $true)][string]$SenderEmail,
  [Parameter(Mandatory = $true)][string]$BrevoApiKey,
  [string]$FleetTrackingUrl = ""
)

$ProjectRef = "yiarfffsaciuodbplxus"
$secrets = @(
  "PROCESS_ORDER_SECRET=$ProcessOrderSecret",
  "TELEMETRY_INGEST_SECRET=$TelemetryIngestSecret",
  "SENDER_EMAIL=$SenderEmail",
  "BREVO_API_KEY=$BrevoApiKey"
)
if ($FleetTrackingUrl) { $secrets += "FLEET_TRACKING_URL=$FleetTrackingUrl" }

npx supabase secrets set --project-ref $ProjectRef @secrets
npx supabase functions deploy process-order --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy telemetry-ingest --project-ref $ProjectRef --no-verify-jwt
npx supabase db push --linked

Write-Host "Ejecuta en SQL Editor de Supabase:"
Write-Host "SELECT vault.create_secret('$ProcessOrderSecret', 'PROCESS_ORDER_SECRET', 'Trigger pg_net');"
Write-Host "SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/process-order', 'PROCESS_ORDER_URL', 'URL de process-order');"
