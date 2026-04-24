#Requires -Version 5.1
<#
.SYNOPSIS
  SSH tunnel so Postgres tools only connect to 127.0.0.1 (works when your Wi‑Fi blocks 5432/6543 to Supabase).

.DESCRIPTION
  Your browser reaches Supabase on HTTPS (443). Drizzle needs the Postgres protocol on 5432/6543, which many
  networks block — you see ETIMEDOUT. This forwards a local port through any cheap VPS that CAN reach Supabase.
  Your PC only opens outbound SSH (22) to the VPS.

  1) Create a Linux VM (e.g. Oracle Cloud free tier, Hetzner CX11, Fly.io machine) with sshd and your SSH key.
  2) Run this script and leave the window open.
  3) Point DATABASE_URL at 127.0.0.1 and the -LocalPort you chose (same user/password as Supabase Connect).

.EXAMPLE
  .\scripts\db-tunnel.ps1 -JumpHost ubuntu@203.0.113.50

  .env.local (session pooler on remote; you connect via localhost):
  DATABASE_URL=postgresql://postgres.zrqstcmubikqikmxfnwj:YOUR_DB_PASSWORD@127.0.0.1:15432/postgres

.EXAMPLE
  Transaction pooler on remote port 6543:
  .\scripts\db-tunnel.ps1 -JumpHost ubuntu@203.0.113.50 -PoolerPort 6543
  DATABASE_URL=postgresql://postgres.zrqstcmubikqikmxfnwj:YOUR_DB_PASSWORD@127.0.0.1:15432/postgres?pgbouncer=true
#>
param(
  [Parameter(Mandatory = $true, HelpMessage = "e.g. ubuntu@your.vps.ip")]
  [string]$JumpHost,

  [int]$LocalPort = 15432,

  [string]$PoolerHost = "aws-1-eu-north-1.pooler.supabase.com",

  [ValidateSet(5432, 6543)]
  [int]$PoolerPort = 5432
)

Write-Host ""
Write-Host "Forwarding 127.0.0.1:$LocalPort -> ${PoolerHost}:$PoolerPort via SSH $JumpHost"
Write-Host "Keep this window open. Use in .env.local:"
Write-Host "  DATABASE_URL=postgresql://postgres.<project_ref>:<password>@127.0.0.1:$LocalPort/postgres"
if ($PoolerPort -eq 6543) {
  Write-Host "  (add ?pgbouncer=true for transaction pooler)"
}
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel."
Write-Host ""

ssh -N -L "${LocalPort}:${PoolerHost}:${PoolerPort}" $JumpHost
