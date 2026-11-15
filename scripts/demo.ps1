# Kredo - required end-to-end demo against the deployed testnet contract (CLI version).
# Run after deploy.ps1:  powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
$ErrorActionPreference = "Continue"
$NET = "testnet"
$d = Get-Content deployments\testnet.json | ConvertFrom-Json
$ID = $d.contractId

function K([string]$src, [string[]]$fnArgs) {
  Write-Host "`n> [$src] $($fnArgs -join ' ')" -ForegroundColor Cyan
  stellar contract invoke --contract-id $ID --source-account $src --network $NET --send yes -- @fnArgs
  return $LASTEXITCODE
}
function V([string]$fnName, [string[]]$fnArgs) {   # read-only (simulated, free)
  Write-Host "`n> [read] $fnName $($fnArgs -join ' ')" -ForegroundColor Cyan
  stellar contract invoke --contract-id $ID --source-account bank --network $NET --send no -- $fnName @fnArgs
}

# SYNTHETIC doc hash (random 32 bytes). Never put a real document number, name or biometric on-chain.
# In production this is an HMAC computed by a secure off-chain service.
$docHash = -join (1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })

Write-Host "1. Organization A registers and locks a 100 XLM bond"
K agency @("register_issuer", "--org", $d.agency, "--bond", "1000000000") | Out-Null
V get_issuer @("--org", $d.agency)

Write-Host "`n2. [SIMULATED identity check passed] Org A issues a level-2 credential (method 2 = in-person document check)"
K agency @("issue_credential", "--issuer", $d.agency, "--holder", $d.holder, "--doc_hash", $docHash, "--level", "2", "--method", "2") | Out-Null

Write-Host "`n3. Organization B verifies on testnet"
V verify @("--holder", $d.holder)

Write-Host "`n4. Duplicate issuance attempt (same doc hash, new holder) - expect Error(Contract, #5) DuplicateId"
$other = (stellar keys address bank).Trim()
$rc = K agency @("issue_credential", "--issuer", $d.agency, "--holder", $other, "--doc_hash", $docHash, "--level", "2", "--method", "2")
if ($rc -ne 0) { Write-Host "Rejected as expected" -ForegroundColor Green }

Write-Host "`n5. Organization B opens a dispute"
K bank @("open_dispute", "--caller", $d.bank, "--holder", $d.holder) | Out-Null

Write-Host "`n6. Two independent panelists vote outcome 1 = IssuerNegligence (2 = PersonDeception, 3 = Valid)"
K panel1 @("vote", "--panelist", $d.panel[0], "--holder", $d.holder, "--outcome", "1") | Out-Null
K panel2 @("vote", "--panelist", $d.panel[1], "--holder", $d.holder, "--outcome", "1") | Out-Null

Write-Host "`n7. Credential revoked, bond slashed 100 -> 50 XLM"
V get_dispute @("--holder", $d.holder)
V get_issuer @("--org", $d.agency)

Write-Host "`n8. Organization B verifies again - expect verified:false, revoked:true"
V verify @("--holder", $d.holder)

Write-Host "`n9. Slashed issuer tries to issue again - expect Error(Contract, #1) BondTooLow (bond 50 < 100 XLM minimum)"
$docHash2 = -join (1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
$rc = K agency @("issue_credential", "--issuer", $d.agency, "--holder", $other, "--doc_hash", $docHash2, "--level", "2", "--method", "2")
if ($rc -ne 0) { Write-Host "Rejected as expected" -ForegroundColor Green }

Write-Host "`n10. Issuer tops its bond back up by 50 XLM"
K agency @("top_up_bond", "--org", $d.agency, "--amount", "500000000") | Out-Null
V get_issuer @("--org", $d.agency)
