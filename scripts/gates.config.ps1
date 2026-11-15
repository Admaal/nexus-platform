# Config de la valla de ESTE proyecto. El motor (gates.ps1) no se edita.

$LintCommand = "npm run lint"
$FastTestCommand = "npm run test -w @nexus/domain"
$FastRoutes = @(
  @{ Prefix = "packages/domain/"; Command = "npm run test -w @nexus/domain" },
  @{ Prefix = "apps/store/"; Command = "npm run test -w @nexus/store" },
  @{ Prefix = "apps/fleet/"; Command = "npm run test -w @nexus/fleet" }
)
$FullCommands = @(
  "npm run typecheck",
  "npm run test",
  "npm run build:store",
  "npm run build:fleet"
)
$MutationCommand = "npm run mutation -w @nexus/domain"
$MutationTool = "stryker"
# Prefijo git que Stryker no ve (se ejecuta dentro del paquete).
$MutationRoot = "packages/domain/"
$PitIncrementalArg = ""
$DomainPaths = @("packages/domain/src/")
$TestFilePattern = '(?i)(\.(test|spec)\.[^/]+|_test\.[^/]+|Test\.(kt|java)$|__tests__/|(^|/)test/)'
