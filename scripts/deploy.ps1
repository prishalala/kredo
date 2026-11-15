# Kredo - build, deploy and initialize on Stellar Testnet.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
$ErrorActionPreference = "Continue"
$NET = "testnet"

function Run([string]$what) {
  if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: $what" -ForegroundColor Red; exit 1 }
}
function Ensure-Key([string]$name) {
  stellar keys address $name *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating + funding key '$name'"
    stellar keys generate $name --network $NET --fund; Run "keys generate $name"
  }
  return (stellar keys address $name).Trim()
}

# 1. Build
stellar contract build; Run "contract build"
$WASM = "target\wasm32v1-none\release\kredo.wasm"

# 2. Testnet accounts (friendbot gives each 10,000 test XLM)
$admin  = Ensure-Key "admin"
$p1     = Ensure-Key "panel1"
$p2     = Ensure-Key "panel2"
$p3     = Ensure-Key "panel3"
$agency = Ensure-Key "agency"   # Organization A (issuer)
$bank   = Ensure-Key "bank"     # Organization B (verifier)
$holder = Ensure-Key "holder"   # demo credential holder
$agency2 = Ensure-Key "agency2" # fresh issuer for the app demo / video (import into Freighter)

# 3. Native XLM Stellar Asset Contract (the bond token)
$XLM = (stellar contract id asset --asset native --network $NET).Trim(); Run "asset id"

# 4. Deploy
$ID = (stellar contract deploy --wasm $WASM --source-account admin --network $NET --alias kredo).Trim(); Run "deploy"
Write-Host "Contract ID: $ID" -ForegroundColor Green

# 5. Initialize (min_bond 100 XLM, max_vouches 5, slash 50%)
$panel = ConvertTo-Json @($p1, $p2, $p3) -Compress
if ($PSVersionTable.PSVersion -lt [version]"7.3") { $panel = $panel -replace '"', '\"' }  # PS 5.1 quote bug
stellar contract invoke --contract-id $ID --source-account admin --network $NET -- initialize `
  --admin $admin --token $XLM --panel $panel `
  --min_bond 1000000000 --max_vouches 5 --slash_percent 50
Run "initialize"

# 6. Record for the app pair + README
$out = [ordered]@{
  network = $NET; rpcUrl = "https://soroban-testnet.stellar.org"
  networkPassphrase = "Test SDF Network ; September 2015"
  contractId = $ID; xlmTokenId = $XLM
  admin = $admin; panel = @($p1, $p2, $p3); agency = $agency; agency2 = $agency2; bank = $bank; holder = $holder
}
New-Item -ItemType Directory -Force deployments | Out-Null
$out | ConvertTo-Json | Set-Content deployments\testnet.json
Write-Host "Wrote deployments\testnet.json" -ForegroundColor Green
Write-Host "Explorer: https://stellar.expert/explorer/testnet/contract/$ID"
