# stop: gauntlet solo si hay cambios. Sin cambios o aborted, sale al momento.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8

function Write-Empty {
  [Console]::Out.WriteLine("{}")
}

$inputJson = [Console]::In.ReadToEnd()
if ($inputJson -and $inputJson.Length -gt 0 -and $inputJson[0] -eq [char]0xFEFF) {
  $inputJson = $inputJson.Substring(1)
}

$status = "completed"
try {
  if ($inputJson) {
    $payload = $inputJson | ConvertFrom-Json
    if ($payload.PSObject.Properties.Name -contains "status" -and $payload.status) {
      $status = [string]$payload.status
    }
  }
} catch {
  $status = "completed"
}

if ($status -eq "aborted") {
  Write-Empty
  exit 0
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repoRoot

$porcelain = & git status --porcelain 2>$null
if ($LASTEXITCODE -ne 0 -or -not $porcelain) {
  Write-Empty
  exit 0
}

$lockPath = Join-Path $PSScriptRoot "gauntlet.lock"
$lockStream = $null
try {
  $lockStream = [System.IO.File]::Open(
    $lockPath,
    [System.IO.FileMode]::OpenOrCreate,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
} catch {
  [Console]::Error.WriteLine("Gauntlet ya en curso; se omite este stop.")
  Write-Empty
  exit 0
}

try {
  $gates = Join-Path (Join-Path $repoRoot "scripts") "gates.ps1"
  $out = & $gates full 2>&1 | Out-String
  $code = $LASTEXITCODE
  if ($code -ne 0 -or $out -match '(?m)^FALLO ') {
    $text = $out.Trim()
    if ($text.Length -gt 8000) {
      $text = $text.Substring($text.Length - 8000)
    }
    $msg = "La gauntlet ha fallado. Corrige antes de dar la tarea por cerrada.`n$text"
    $json = @{ followup_message = $msg } | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($json)
  } else {
    Write-Empty
  }
} finally {
  if ($lockStream) {
    $lockStream.Close()
    $lockStream.Dispose()
  }
}
exit 0
