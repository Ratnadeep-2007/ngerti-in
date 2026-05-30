#!/bin/bash

echo "Starting all services for Lumina.ai..."

# Kill any zombie Node processes on port 3006 before starting
lsof -ti:3006 | xargs kill -9 2>/dev/null || true

# Function to clean up background processes on exit
cleanup() {
    echo "Stopping all services..."
    # Kill all child processes started by this script
    kill $(jobs -p) 2>/dev/null
    exit
}
# Trap Ctrl+C (SIGINT) and termination signals
trap cleanup SIGINT SIGTERM

# 1. Start Cloudflare Tunnel
echo "Starting Cloudflare tunnel..."
if ! command -v cloudflared &> /dev/null; then
    echo "Error: cloudflared is not installed or not in your PATH. Please install it with 'brew install cloudflared' and try again."
    exit 1
fi
cloudflared tunnel --url http://localhost:3006 > cloudflared.log 2>&1 &

# 2. Wait for Cloudflare URL
echo "Waiting for Cloudflare tunnel URL..."
URL=""
while [ -z "$URL" ]; do
    sleep 1
    URL=$(grep -o 'https://[-a-zA-Z0-9]*\.trycloudflare\.com' cloudflared.log | head -1)
done

echo "Cloudflare Tunnel URL found: $URL"

# 3. Update .env file dynamically
echo "Updating .env file with new URL..."
sed -i '' "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"$URL\"|" .env
sed -i '' "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=\"$URL\"|" .env
echo ".env updated."

# 4. Dynamically update Stream Webhook
echo "Updating Stream Webhook URL..."
npx tsx update_stream_webhook.ts "$URL/api/webhook"

# 5. Start Inngest Background Worker
echo "Starting Inngest..."
npm run dev:inngest > inngest.log 2>&1 &

# 6. Start Next.js Development Server
echo "Starting Next.js..."
npm run dev

# Wait for Next.js to exit
wait
