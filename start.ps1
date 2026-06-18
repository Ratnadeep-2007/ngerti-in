# start.ps1 - Automated startup for Windows

Write-Host "Cleaning up zombie processes on port 3006..." -ForegroundColor Cyan
$processId = Get-NetTCPConnection -LocalPort 3006 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($processId) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "Killed process $processId on port 3006." -ForegroundColor Green
}

# 1. Start Cloudflare Tunnel
Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Cyan
$cloudflaredCmd = "cloudflared"
if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    $fallbackPaths = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "C:\Program Files\cloudflared\cloudflared.exe"
    )
    $foundFallback = $false
    foreach ($path in $fallbackPaths) {
        if (Test-Path $path) {
            $cloudflaredCmd = $path
            $foundFallback = $true
            break
        }
    }
    if (!$foundFallback) {
        Write-Host "Error: cloudflared is not installed. Please install it and try again." -ForegroundColor Red
        return
    }
}

# Remove old log files to ensure we don't read a stale URL
Remove-Item "cloudflared.log" -ErrorAction SilentlyContinue
Remove-Item "cloudflared.err" -ErrorAction SilentlyContinue

# Start cloudflared in background and redirect outputs separately
Start-Process $cloudflaredCmd -ArgumentList "tunnel --url http://localhost:3006" -RedirectStandardOutput "cloudflared.log" -RedirectStandardError "cloudflared.err" -NoNewWindow

# 2. Wait for Cloudflare URL
Write-Host "Waiting for Cloudflare tunnel URL..." -ForegroundColor Cyan
$URL = ""
while ($true) {
    Start-Sleep -Seconds 2
    $content = ""
    if (Test-Path "cloudflared.log") {
        $content += Get-Content "cloudflared.log" -Raw
    }
    if (Test-Path "cloudflared.err") {
        $content += Get-Content "cloudflared.err" -Raw
    }
    if ($content -match "https://[-a-zA-Z0-9]*\.trycloudflare\.com") {
        $URL = $matches[0]
        break
    }
}

Write-Host "Cloudflare Tunnel URL found: $URL" -ForegroundColor Green

# 3. Update .env file
Write-Host "Updating .env file with new URL..." -ForegroundColor Cyan
$envPath = ".env"
if (Test-Path $envPath) {
    (Get-Content $envPath) -replace '^NEXT_PUBLIC_APP_URL=.*', "NEXT_PUBLIC_APP_URL=`"$URL`"" `
                       -replace '^BETTER_AUTH_URL=.*', "BETTER_AUTH_URL=`"$URL`"" | Set-Content $envPath
    Write-Host ".env updated." -ForegroundColor Green
}

# 4. Update Stream Webhook
Write-Host "Waiting 5 seconds for Cloudflare DNS to propagate..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
Write-Host "Updating Stream Webhook URL..." -ForegroundColor Cyan
npx.cmd tsx update_stream_webhook.ts "$URL/api/webhook"

# 5. Start Inngest Background Worker
Write-Host "Starting Inngest..." -ForegroundColor Cyan
Start-Process npm.cmd -ArgumentList "run dev:inngest" -NoNewWindow

# 6. Start Next.js Development Server
Write-Host "Starting Next.js..." -ForegroundColor Cyan
npm.cmd run dev
