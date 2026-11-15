# postToolUse: bucle rapido. Siempre devuelve additional_context (el agente no ve el exit de afterFileEdit).
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8

function Emit([string]$text) {
  if ($null -eq $text) { $text = "" }
  $text = $text.Trim()
  if ($text.Length -gt 8000) {
    $text = $text.Substring($text.Length - 8000)
  }
  $json = @{ additional_context = $text } | ConvertTo-Json -Compress
  [Console]::Out.WriteLine($json)
}

function Get-RelativePath([string]$candidate, [string]$root) {
  if (-not $candidate) { return $null }
  try {
    if ($candidate -match '^file://') {
      $candidate = ([Uri]$candidate).LocalPath
    }
    $full = [System.IO.Path]::GetFullPath($candidate)
    $sep = [System.IO.Path]::DirectorySeparatorChar
    $prefix = $root.TrimEnd('\', '/') + $sep
    if ($full.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $full.Substring($prefix.Length).Replace("\", "/")
    }
  } catch {
    return $candidate.Replace("\", "/").TrimStart("/")
  }
  return $candidate.Replace("\", "/").TrimStart("/")
}

$inputJson = [Console]::In.ReadToEnd()
if ($inputJson -and $inputJson.Length -gt 0 -and $inputJson[0] -eq [char]0xFEFF) {
  $inputJson = $inputJson.Substring(1)
}

$payload = $null
try {
  if ($inputJson) { $payload = $inputJson | ConvertFrom-Json }
} catch {
  $payload = $null
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repoRoot

$path = $null
if ($payload) {
  foreach ($key in @("file_path", "filePath", "path")) {
    if ($payload.PSObject.Properties.Name -contains $key -and $payload.$key) {
      $path = [string]$payload.$key
      break
    }
  }
  if (-not $path -and $payload.tool_input) {
    $toolInput = $payload.tool_input
    if ($toolInput -is [string]) {
      try { $toolInput = $toolInput | ConvertFrom-Json } catch { $toolInput = $null }
    }
    if ($toolInput) {
      foreach ($key in @("path", "file_path", "filePath", "target_file")) {
        if ($toolInput.PSObject.Properties.Name -contains $key -and $toolInput.$key) {
          $path = [string]$toolInput.$key
          break
        }
      }
    }
  }
}

$relative = "<ruta desconocida>"
if ($path) {
  $rel = Get-RelativePath $path $repoRoot
  if ($rel) { $relative = $rel }
}

$gates = Join-Path (Join-Path $repoRoot "scripts") "gates.ps1"
if (-not (Test-Path $gates)) {
  Emit "postToolUse: no existe scripts/gates.ps1"
  exit 0
}

$out = & $gates fast $relative 2>&1 | Out-String
Emit "postToolUse [$relative]`n$out"
exit 0
