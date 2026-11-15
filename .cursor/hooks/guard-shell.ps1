# Bloquea comandos que borran trabajo sin commitear.
# Si el JSON de entrada no se puede leer, el comando se permite (fallo abierto):
# un hook que no entiende la entrada no debe tumbar la terminal.
$ErrorActionPreference = "Continue"
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8

function Write-Allow {
  [Console]::Out.WriteLine('{"permission":"allow"}')
}

function Write-Deny([string]$why) {
  $obj = @{
    permission    = "deny"
    user_message  = "Comando bloqueado por la valla: $why"
    agent_message = "La valla ha bloqueado este comando ($why). No lo reintentes. Si hace falta de verdad, lo ejecuta la persona en su terminal."
  }
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
}

function Strip-OnePair([string]$s) {
  $s = $s.Trim()
  if ($s.Length -ge 2) {
    $a = $s[0]
    $b = $s[$s.Length - 1]
    if (($a -eq [char]34 -and $b -eq [char]34) -or ($a -eq [char]39 -and $b -eq [char]39)) {
      return $s.Substring(1, $s.Length - 2).Trim()
    }
  }
  return $s
}

function Unwrap-Shell([string]$s) {
  $s = $s.Trim()
  if ($s -match '(?i)^cmd(?:\.exe)?\s+/c\s+(.+)$') { return (Strip-OnePair $matches[1]) }
  if ($s -match '(?i)^(?:powershell|pwsh)(?:\.exe)?\s+(.*)$') {
    $rest = $matches[1]
    if ($rest -match '(?i)(?:^|\s)(?:-c|-Command)\s+(.+)$') { return (Strip-OnePair $matches[1]) }
  }
  if ($s -match '(?i)^(?:bash|sh)\s+-c\s+(.+)$') { return (Strip-OnePair $matches[1]) }
  return $s
}

function Get-Invocation([string]$segment) {
  $s = $segment.Trim()
  for ($n = 0; $n -lt 4; $n++) {
    $next = Unwrap-Shell $s
    if ($next -eq $s) { break }
    $s = $next
  }
  return $s.Trim()
}

function Get-GitNormalized([string]$s) {
  if ($s -notmatch '(?i)^git\b') { return $s }
  $tokens = @($s -split '\s+' | Where-Object { $_ -ne '' })
  $i = 1
  while ($i -lt $tokens.Count) {
    $t = $tokens[$i]
    if ($t -match '^(?i)-C$') { $i += 2; continue }
    if ($t -match '^(?i)-C.+') { $i += 1; continue }
    if ($t -match '^(?i)--git-dir=') { $i += 1; continue }
    if ($t -match '^(?i)--work-tree=') { $i += 1; continue }
    break
  }
  if ($i -ge $tokens.Count) { return $s }
  $rest = @()
  for ($j = $i; $j -lt $tokens.Count; $j++) { $rest += $tokens[$j] }
  if ($rest.Count -eq 0) { return $s }
  return ("git " + ($rest -join " ")).Trim()
}

function Test-GitResetHard([string]$s) {
  return $s -match '(?i)^git\s+reset\b' -and $s -match '(?i)(^|\s)--hard(\s|$)'
}

function Test-GitCheckoutPath([string]$s) {
  if ($s -notmatch '(?i)^git\s+checkout\b') { return $false }
  if ($s -match '(^|\s)--(\s|$)') { return $true }
  $tokens = @($s -split '\s+' | Where-Object { $_ -ne '' })
  $i = 2
  while ($i -lt $tokens.Count) {
    $t = $tokens[$i]
    if ($t -match '^(?i)-b$') { $i += 2; continue }
    if ($t -match '^(?i)--orphan$') { $i += 2; continue }
    if ($t -match '^-') { $i += 1; continue }
    if ($t -eq '.' -or $t -eq './' -or $t.StartsWith('./') -or $t.StartsWith('.\') -or $t.Contains('/') -or $t.Contains('\')) {
      return $true
    }
    $i += 1
  }
  return $false
}

function Test-GitRestoreWorktree([string]$s) {
  if ($s -notmatch '(?i)^git\s+restore\b') { return $false }
  $tokens = @($s -split '\s+' | Where-Object { $_ -ne '' } | Select-Object -Skip 2)
  foreach ($t in $tokens) {
    if ($t -match '^-' -and $t -ne '--staged') { return $true }
  }
  $flags = @($tokens | Where-Object { $_ -match '^-' })
  if ($flags.Count -eq 0) { return $true }
  return $false
}

function Test-GitStashDestroy([string]$s) {
  return $s -match '(?i)^git\s+stash\s+(drop|clear)\b'
}

function Test-GitClean([string]$s) {
  if ($s -notmatch '(?i)^git\s+clean\b') { return $false }
  $hasF = $false
  $hasD = $false
  foreach ($t in ($s -split '\s+')) {
    if ($t -match '^-[A-Za-z]+$') {
      if ($t -match 'f') { $hasF = $true }
      if ($t -match 'd') { $hasD = $true }
    }
  }
  return ($hasF -and $hasD)
}

function Test-RmRf([string]$s) {
  if ($s -notmatch '(?i)^rm\s+') { return $false }
  $hasR = $false
  $hasF = $false
  foreach ($t in ($s -split '\s+')) {
    if ($t -match '(?i)^--recursive$') { $hasR = $true }
    if ($t -eq '--force') { $hasF = $true }
    if ($t -match '^-[A-Za-z]+$') {
      if ($t -match 'r') { $hasR = $true }
      if ($t -match 'f') { $hasF = $true }
    }
  }
  return ($hasR -and $hasF)
}

function Trim-Dir([string]$path) {
  return $path.TrimEnd('\', '/')
}

function Test-PathInside([string]$full, [string]$root) {
  if ($full.Equals($root, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
  $sep = [System.IO.Path]::DirectorySeparatorChar
  return $full.StartsWith($root + $sep, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-IsDeleteFlag([string]$t) {
  if ($t -match '^(?i)-') { return $true }
  if ($t -match '^(?i)/[a-z?]+$') { return $true }
  return $false
}

function Test-HasRecursiveFlag([string[]]$tokens) {
  foreach ($t in $tokens) {
    if ($t -match '^(?i)-r$') { return $true }
    if ($t -match '^(?i)-rec(urse)?(:.*)?$') { return $true }
    if ($t -match '^(?i)/s$') { return $true }
  }
  return $false
}

function Test-RemoveItemHitsRepo([string]$s, [string]$cwd) {
  $tokens = @($s -split '\s+' | Where-Object { $_ -ne '' })
  if ($tokens.Count -eq 0) { return $false }
  $name = $tokens[0].Trim('"').Trim("'")
  if ($name -notmatch '^(?i)(Remove-Item|ri|del|erase|rd|rmdir)$') { return $false }
  if (-not (Test-HasRecursiveFlag $tokens)) { return $false }
  $paths = @()
  foreach ($t in ($tokens | Select-Object -Skip 1)) {
    $clean = $t.Trim('"').Trim("'")
    if (Test-IsDeleteFlag $clean) { continue }
    $paths += $clean
  }
  if ($paths.Count -eq 0) { return $true }
  $cwdFull = ""
  try { $cwdFull = Trim-Dir ([System.IO.Path]::GetFullPath($cwd)) } catch { return $true }
  foreach ($p in $paths) {
    if ($p -match '(?i)^\$env:(TEMP|TMP)\b') { continue }
    if ($p -match '(?i)^/tmp(/|$)') {
      try {
        if (-not (Test-PathInside (Trim-Dir ([System.IO.Path]::GetFullPath($p))) $cwdFull)) { continue }
      } catch {
        continue
      }
    }
    if ($p -match '(?i)^[A-Za-z]:\\Windows\\Temp\\') { continue }
    if ($p -match '(?i)^[A-Za-z]:\\Users\\[^\\]+\\AppData\\Local\\Temp\\') { continue }
    try {
      if ([System.IO.Path]::IsPathRooted($p)) {
        $full = [System.IO.Path]::GetFullPath($p)
      } else {
        $full = [System.IO.Path]::GetFullPath((Join-Path $cwd $p))
      }
      if (Test-PathInside (Trim-Dir $full) $cwdFull) { return $true }
    } catch {
      return $true
    }
  }
  return $false
}

function Test-MainProtected([string]$cwd) {
  $root = & git -C $cwd rev-parse --show-toplevel 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $root) { return $false }
  $top = ([string]$root).Trim()
  return Test-Path (Join-Path (Join-Path $top ".cursor") "proteger-main")
}

function Test-PushToMain([string]$s, [string]$cwd) {
  if ($s -notmatch '(?i)^git\s+push\b') { return $false }
  $tokens = @(($s -split '\s+') | Select-Object -Skip 2 | ForEach-Object { $_.Trim('"').Trim("'") })
  foreach ($t in $tokens) {
    if ($t -eq '--all' -or $t -eq '--mirror') { return $true }
  }
  $positional = @($tokens | Where-Object { $_ -and $_ -notmatch '^-' })
  $refspecs = @($positional | Select-Object -Skip 1)
  if ($refspecs.Count -eq 0) {
    $branch = & git -C $cwd rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $branch) { return $true }
    $refspecs = @(([string]$branch).Trim())
  }
  foreach ($r in $refspecs) {
    $dest = $r.TrimStart('+')
    if ($dest.Contains(':')) { $dest = $dest.Substring($dest.LastIndexOf(':') + 1) }
    if ($dest -eq 'HEAD') {
      $branch = & git -C $cwd rev-parse --abbrev-ref HEAD 2>$null
      $dest = ([string]$branch).Trim()
    }
    $dest = $dest -replace '^refs/heads/', ''
    if ($dest -eq 'main' -or $dest -eq 'master') { return $true }
  }
  return $false
}

function Test-ScriptDelete([string]$s) {
  if ($s -match '(?i)\b(rmtree|os\.remove|os\.unlink|shutil\.rm|\bunlink\b|\brmdir\b)' -and $s -match '(?i)^(python3?(\.exe)?|py)\s') {
    return $true
  }
  if ($s -match '(?i)\b(rmSync|rmdirSync|unlinkSync|fs\.rm|fs\.unlink)\b' -and $s -match '(?i)^node\s') {
    return $true
  }
  if ($s -match '(?i)^find\b' -and $s -match '(^|\s)-delete(\s|$)') { return $true }
  if ($s -match '(?i)^xargs\b' -and $s -match '(?i)(^|\s)rm(\s|$)') { return $true }
  return $false
}

function Test-RiskyCommand([string]$s) {
  if ($s -match '(?i)^(rm|del|erase|rmdir|rd|mv|move|Remove-Item|ri)\b') { return $true }
  if ($s -match '(?i)^git\s+(reset|checkout|restore|clean|stash|rebase|branch\s+-D)\b') { return $true }
  if ($s -match '(?i)^(python3?|py|node|find|xargs|powershell|pwsh|bash|sh)\s') { return $true }
  return $false
}

# Guarda el arbol de trabajo en refs/valla/checkpoints sin tocar el indice ni el arbol.
# Falla en abierto: si el checkpoint no se puede crear, el comando sigue adelante.
function Save-Checkpoint([string]$cwd) {
  try {
    $root = & git -C $cwd rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $root) { return }
    $root = ([string]$root).Trim()
    $tempIndex = Join-Path ([System.IO.Path]::GetTempPath()) ("valla-index-" + [guid]::NewGuid().ToString("n"))
    $env:GIT_INDEX_FILE = $tempIndex
    try {
      & git -C $root add -A 2>$null | Out-Null
      if ($LASTEXITCODE -ne 0) { return }
      $tree = (& git -C $root write-tree 2>$null)
      if ($LASTEXITCODE -ne 0 -or -not $tree) { return }
      $tree = ([string]$tree).Trim()
      $parent = (& git -C $root rev-parse --verify --quiet HEAD 2>$null)
      # Identidad explicita: en un runner de CI no hay user.name ni user.email globales.
      $commitArgs = @("-c", "user.email=valla@local", "-c", "user.name=valla", "commit-tree", $tree, "-m", "valla: checkpoint antes de un borrado")
      if ($LASTEXITCODE -eq 0 -and $parent) { $commitArgs += @("-p", ([string]$parent).Trim()) }
      $commit = (& git -C $root @commitArgs 2>$null)
      if ($LASTEXITCODE -ne 0 -or -not $commit) { return }
      $stamp = Get-Date -Format "yyyyMMddTHHmmssfff"
      & git -C $root update-ref "refs/valla/checkpoints/$stamp" ([string]$commit).Trim() 2>$null | Out-Null
    } finally {
      Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
      Remove-Item $tempIndex -ErrorAction SilentlyContinue
    }
    $refs = @(& git -C $root for-each-ref --sort=creatordate --format="%(refname)" "refs/valla/checkpoints" 2>$null | Where-Object { $_ })
    if ($refs.Count -gt 20) {
      foreach ($old in ($refs | Select-Object -First ($refs.Count - 20))) {
        & git -C $root update-ref -d ([string]$old).Trim() 2>$null | Out-Null
      }
    }
  } catch {
    return
  }
}

$inputJson = [Console]::In.ReadToEnd()
if ($inputJson -and $inputJson.Length -gt 0 -and $inputJson[0] -eq [char]0xFEFF) {
  $inputJson = $inputJson.Substring(1)
}

$command = ""
$cwd = (Get-Location).Path
try {
  if ($inputJson) {
    $payload = $inputJson | ConvertFrom-Json
    if ($payload.command) { $command = [string]$payload.command }
    if ($payload.cwd) { $cwd = [string]$payload.cwd }
  }
} catch {
  Write-Allow
  exit 0
}

if (-not $command) {
  Write-Allow
  exit 0
}

$segments = [regex]::Split($command, '\s*(?:&&|\|\||;|\|)\s*')
$why = ""
# Un `;` dentro de comillas (`python -c "a; b"`) parte los segmentos: el comando
# completo tambien se mira para no dejar pasar un borrado por ese hueco.
if (Test-ScriptDelete $command) { $why = "borrado desde un script" }
foreach ($seg in $segments) {
  if ($why) { break }
  $s = Get-GitNormalized (Get-Invocation $seg)
  if (Test-GitResetHard $s) { $why = "git reset --hard"; break }
  if (Test-GitCheckoutPath $s) { $why = "git checkout de una ruta"; break }
  if (Test-GitRestoreWorktree $s) { $why = "git restore fuera de --staged"; break }
  if (Test-GitStashDestroy $s) { $why = "git stash drop o clear"; break }
  if (Test-GitClean $s) { $why = "git clean -fd"; break }
  if (Test-RmRf $s) { $why = "rm -rf"; break }
  if (Test-ScriptDelete $s) { $why = "borrado desde un script"; break }
  if (Test-RemoveItemHitsRepo $s $cwd) { $why = "borrado recursivo dentro del repo"; break }
  if ((Test-PushToMain $s $cwd) -and (Test-MainProtected $cwd)) { $why = "git push directo a main; usa una rama y un PR con CI en verde"; break }
}

if ($why) { Write-Deny $why } else {
  foreach ($seg in $segments) {
    $s = Get-GitNormalized (Get-Invocation $seg)
    if (Test-RiskyCommand $s) { Save-Checkpoint $cwd; break }
  }
  Write-Allow
}
exit 0
