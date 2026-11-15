# Motor de la valla: lo sustituye el comando de actualizacion del kit.
# Los comandos del proyecto viven en scripts/gates.config.ps1 y este fichero no
# los toca. `full` (lo llama stop) corre la mutacion incremental; `ci`, la completa.
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Mode,
  # fast acepta varias rutas: gates.ps1 fast a.ts b.ts ...
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Route = @()
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

$configPath = Join-Path $PSScriptRoot "gates.config.ps1"
if (-not (Test-Path $configPath)) {
  Write-Output "FALLO falta scripts/gates.config.ps1: los comandos de la valla viven ahi"
  exit 1
}
. $configPath

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
$timingLog = Join-Path (Join-Path (Join-Path $repoRoot ".cursor") "hooks") "gate-timings.log"
# Evidencia del RED. Se versiona para que el verificador la vea en otra maquina o en el PR.
$redLog = Join-Path (Join-Path $repoRoot ".cursor") "red.log"
$timingDir = Split-Path $timingLog
if (-not (Test-Path $timingDir)) {
  New-Item -ItemType Directory -Path $timingDir -Force | Out-Null
}

# $IsWindows no existe en Windows PowerShell 5.1 (Desktop): alli siempre es Windows.
$script:onWindows = ($PSVersionTable.PSEdition -eq "Desktop") -or [bool]$IsWindows

$script:headSha = "no-sha"
$parsedSha = & git rev-parse HEAD 2>$null
if ($LASTEXITCODE -eq 0 -and $parsedSha) {
  $script:headSha = ([string]$parsedSha).Trim()
}

if ($Mode -ne "fast" -and $Mode -ne "full" -and $Mode -ne "ci") {
  Write-Output "Uso: gates.ps1 fast [ruta] | full | ci"
  exit 1
}

$script:failed = $false
$script:todoLeft = $false
$log = New-Object System.Collections.Generic.List[string]

function Test-Todo([string]$command) {
  return [string]::IsNullOrWhiteSpace($command) -or $command -match '(?i)\bTODO[-A-Z0-9]*'
}

function Test-IsTestFile([string]$relative) {
  return $relative -match $TestFilePattern
}

function Add-RedLine([string]$route, $code) {
  $stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
  Add-Content -Path $redLog -Value "$stamp fast $script:headSha RED $route exit=$code" -Encoding utf8 -ErrorAction SilentlyContinue
}

function Invoke-Gate([string]$name, [string]$command) {
  if (Test-Todo $command) {
    $script:todoLeft = $true
    $log.Add("OMITIDO ${name}: marcador sin rellenar ($command)")
    return $null
  }

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $outFile = [System.IO.Path]::GetTempFileName()
  $utf8 = New-Object System.Text.UTF8Encoding $false
  if ($script:onWindows) {
    $cmdFile = [System.IO.Path]::ChangeExtension($outFile, ".cmd")
    [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`n$command`r`n", $utf8)
    & cmd /c "`"$cmdFile`" > `"$outFile`" 2>&1"
  } else {
    $cmdFile = [System.IO.Path]::ChangeExtension($outFile, ".sh")
    [System.IO.File]::WriteAllText($cmdFile, "$command`n", $utf8)
    & bash $cmdFile > $outFile 2>&1
  }
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 1 }
  $sw.Stop()
  $ms = $sw.ElapsedMilliseconds
  $log.Add("<< ${name}: $ms ms (exit $code)")
  $stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
  Add-Content -Path $timingLog -Value "$stamp $Mode $script:headSha $name $ms ms exit=$code" -Encoding utf8 -ErrorAction SilentlyContinue
  if ($code -ne 0) {
    $script:failed = $true
    $tail = @(Get-Content -Path $outFile -Tail 80 -ErrorAction SilentlyContinue)
    foreach ($line in $tail) { $log.Add([string]$line) }
    $log.Add("FALLO $name (exit $code)")
  }
  Remove-Item $outFile -ErrorAction SilentlyContinue
  Remove-Item $cmdFile -ErrorAction SilentlyContinue
  return $code
}

function Add-GitNames([System.Collections.Generic.List[string]]$names, [string[]]$items) {
  foreach ($n in @($items)) {
    if ($n) { $names.Add([string]$n) }
  }
}

function Test-GitRef([string]$ref) {
  & git rev-parse --verify --quiet $ref 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

function Get-DiffNames([string]$range) {
  $out = @(& git diff --name-only $range 2>$null)
  if ($LASTEXITCODE -ne 0) { return @() }
  return @($out | Where-Object { $_ })
}

function Get-ChangedFiles {
  $names = New-Object System.Collections.Generic.List[string]
  Add-GitNames $names @(& git diff --name-only 2>$null)
  Add-GitNames $names @(& git diff --name-only --cached 2>$null)
  Add-GitNames $names @(& git ls-files --others --exclude-standard 2>$null)

  $base = $null
  if (Test-GitRef "origin/main") { $base = "origin/main" }
  elseif (Test-GitRef "origin/master") { $base = "origin/master" }
  if ($base) {
    Add-GitNames $names (Get-DiffNames "$base...HEAD")
  } elseif ($env:GITHUB_BASE_SHA) {
    Add-GitNames $names (Get-DiffNames "$($env:GITHUB_BASE_SHA)...HEAD")
  }

  if ($names.Count -eq 0 -and $env:GITHUB_ACTIONS -eq "true") {
    Add-GitNames $names (Get-DiffNames "HEAD~1...HEAD")
  }
  return @($names)
}

function Get-ChangedDomainFiles {
  $found = New-Object System.Collections.Generic.List[string]
  foreach ($n in (Get-ChangedFiles)) {
    if (-not $n) { continue }
    $norm = ([string]$n).Replace("\", "/")
    foreach ($p in $DomainPaths) {
      $prefix = ([string]$p).Replace("\", "/")
      if ($prefix -and -not (Test-Todo $prefix) -and $norm.StartsWith($prefix)) {
        if (-not $found.Contains($norm)) { $found.Add($norm) }
        break
      }
    }
  }
  return @($found)
}

function Get-StrykerRelative([string]$path) {
  $norm = $path.Replace("\", "/")
  $root = ([string]$MutationRoot).Replace("\", "/")
  if ($root -and -not $root.EndsWith("/")) { $root = "$root/" }
  if ($root -and $norm.StartsWith($root)) {
    return $norm.Substring($root.Length)
  }
  return $norm
}

function Get-MutationInvocation([string]$gateMode, [string[]]$domainFiles) {
  if ($gateMode -eq "ci") {
    return $MutationCommand
  }
  if ($MutationTool -eq "pit") {
    return "$MutationCommand $PitIncrementalArg"
  }
  $prod = New-Object System.Collections.Generic.List[string]
  foreach ($file in @($domainFiles)) {
    if (-not $file) { continue }
    # Un fichero borrado no se puede mutar.
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $file))) { continue }
    $rel = Get-StrykerRelative $file
    if ($rel -match '(?i)\.(test|spec)\.(ts|tsx|js|jsx)$') { continue }
    if ($rel -match '(^|/)__tests__/') { continue }
    if (-not $prod.Contains($rel)) { $prod.Add($rel) }
  }
  # npx pasa los flags directamente a Stryker; npm run necesita `--`.
  $sep = " --"
  if ($MutationCommand -match '^\s*npx\b') { $sep = "" }
  if ($prod.Count -eq 0) {
    return "$MutationCommand$sep --incremental"
  }
  $list = ($prod -join ",")
  return "$MutationCommand$sep --incremental --mutate `"$list`""
}

function Write-GateResult {
  $resultExit = 0
  if ($script:failed) { $resultExit = 1 }
  $stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
  Add-Content -Path $timingLog -Value "$stamp $Mode $script:headSha RESULT 0 ms exit=$resultExit" -Encoding utf8 -ErrorAction SilentlyContinue
}

if ($Mode -eq "fast") {
  Invoke-Gate "lint" $LintCommand
  # Una pasada por cada prefijo de $FastRoutes que toque alguna ruta, en el orden
  # de $FastRoutes. La suite por defecto solo si alguna ruta no encaja (o no hay rutas).
  $routes = @($Route | Where-Object { $_ } | ForEach-Object { ([string]$_).Replace("\", "/").TrimStart("/") })
  $matched = New-Object System.Collections.Generic.List[int]
  $needDefault = $routes.Count -eq 0
  foreach ($relative in $routes) {
    $hit = $false
    for ($k = 0; $k -lt $FastRoutes.Count; $k++) {
      $prefix = [string]$FastRoutes[$k].Prefix
      if (-not (Test-Todo $prefix) -and $relative.StartsWith($prefix)) {
        if (-not $matched.Contains($k)) { $matched.Add($k) }
        $hit = $true
        break
      }
    }
    if (-not $hit) { $needDefault = $true }
  }
  for ($k = 0; $k -lt $FastRoutes.Count; $k++) {
    if ($matched.Contains($k)) {
      $prefix = [string]$FastRoutes[$k].Prefix
      $code = Invoke-Gate "test[$prefix]" ([string]$FastRoutes[$k].Command)
      if ($null -ne $code -and $code -ne 0) {
        foreach ($relative in $routes) {
          if ($relative.StartsWith($prefix) -and (Test-IsTestFile $relative)) {
            Add-RedLine $relative $code
          }
        }
      }
    }
  }
  if ($needDefault) {
    $code = Invoke-Gate "test" $FastTestCommand
    if ($null -ne $code -and $code -ne 0) {
      foreach ($relative in $routes) {
        $hit = $false
        for ($k = 0; $k -lt $FastRoutes.Count; $k++) {
          $prefix = [string]$FastRoutes[$k].Prefix
          if (-not (Test-Todo $prefix) -and $relative.StartsWith($prefix)) { $hit = $true; break }
        }
        if (-not $hit -and (Test-IsTestFile $relative)) { Add-RedLine $relative $code }
      }
    }
  }
} else {
  $i = 0
  foreach ($c in $FullCommands) {
    $i++
    Invoke-Gate "full-$i" $c
  }
  $domainFiles = @(Get-ChangedDomainFiles)
  $domainTodo = @($DomainPaths | Where-Object { Test-Todo ([string]$_) }).Count -gt 0
  $rootTodo = ($MutationTool -eq "stryker") -and (Test-Todo ([string]$MutationRoot))
  $rootTodo = $rootTodo -or (($MutationTool -eq "pit") -and (Test-Todo ([string]$PitIncrementalArg)))
  if ((Test-Todo $MutationCommand) -or (Test-Todo ([string]$MutationTool)) -or $domainTodo -or $rootTodo) {
    $script:todoLeft = $true
    $log.Add("OMITIDO mutation: marcador sin rellenar")
  } elseif ($Mode -ne "ci" -and $domainFiles.Count -eq 0) {
    $log.Add("Mutation omitida: el dominio no cambio.")
  } else {
    $mutationCmd = Get-MutationInvocation $Mode $domainFiles
    $log.Add("CMD mutation: $mutationCmd")
    Invoke-Gate "mutation" $mutationCmd
  }
  if ($script:todoLeft) {
    $script:failed = $true
    $log.Add("FALLO marcadores: rellena los TODO de scripts/gates.ps1")
  }
  Write-GateResult
}

foreach ($line in $log) { Write-Output $line }
if ($script:failed) { exit 1 }
exit 0
