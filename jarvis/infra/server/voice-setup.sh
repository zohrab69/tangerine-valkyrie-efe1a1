#!/usr/bin/env bash
# JARVIS screen: password-protected page at https://jarvis.<ip>.sslip.io that talks to n8n.
#   Run as root on the server:  bash /root/jarvis-server/voice-setup.sh
#   New password later:         bash /root/jarvis-server/voice-setup.sh --new-password
# Safe to re-run. Keeps the existing password and key unless --new-password.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root"; exit 1; }
cd "$(dirname "$0")"
APP=/opt/jarvis
[ -f "$APP/.env" ] || { echo "Run setup.sh first"; exit 1; }

echo "==> Screen files"
mkdir -p "$APP/jarvis-ui"
cp ui/index.html "$APP/jarvis-ui/index.html"

echo "==> JARVIS voice (Piper, free and offline). First time: builds for a few minutes"
rm -rf "$APP/tts" && cp -r tts "$APP/tts"

echo "==> Key between the screen and n8n"
if ! grep -q '^VOICE_SECRET=' "$APP/.env"; then
  echo "VOICE_SECRET=$(openssl rand -hex 32)" >> "$APP/.env"
fi
VOICE_SECRET=$(grep '^VOICE_SECRET=' "$APP/.env" | cut -d= -f2)

PASSWORD=""
if [ ! -s "$APP/ui-auth.hash" ] || [ "${1:-}" = "--new-password" ]; then
  echo "==> Screen password"
  PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
  docker run --rm caddy:2.10-alpine caddy hash-password --plaintext "$PASSWORD" > "$APP/ui-auth.hash"
  chmod 600 "$APP/ui-auth.hash"
fi

echo "==> Web server config"
cp compose.yml "$APP/compose.yml"
bash ./caddy-config.sh
cd "$APP"
docker compose config --quiet
if docker compose build -q jarvis-tts || { echo "   build failed, retrying once in 20 s..."; sleep 20; docker compose build -q jarvis-tts; }; then
  docker compose up -d jarvis-tts
else
  echo "   WARNING: new voice could not be built (download problem). Keeping the current voice; run this script again later."
fi
for i in $(seq 1 30); do
  docker compose exec -T jarvis-tts python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:5000/health',timeout=3)" 2>/dev/null && break; sleep 2
done
echo "   voice service: $(docker compose exec -T jarvis-tts python -c "import urllib.request,json;print(urllib.request.urlopen('http://127.0.0.1:5000/health',timeout=3).read().decode())" 2>/dev/null || echo 'NOT READY')"
docker compose up -d caddy
docker compose restart caddy >/dev/null

N8N_HOST=$(grep '^N8N_HOST=' .env | cut -d= -f2); JARVIS_HOST="jarvis.${N8N_HOST#n8n.}"
echo "==> Waiting for the HTTPS certificate"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$JARVIS_HOST/" || true)
  [ "$code" = "401" ] && break; sleep 3
done
echo "   without password: HTTP $code (401 = protected, correct)"
curl -fsS "https://$N8N_HOST/healthz" >/dev/null && echo "   n8n still online: yes"

echo
echo "================ JARVIS SCREEN ================"
echo "Address : https://$JARVIS_HOST"
echo "Username: owner"
if [ -n "$PASSWORD" ]; then
  echo "Password: $PASSWORD"
  echo "  -> save it in your password manager NOW; it is not stored anywhere in readable form."
else
  echo "Password: unchanged (use --new-password to make a new one)"
fi
echo
echo "n8n credential for the Webhook node (Header Auth, name 'JARVIS screen key'):"
echo "  Name : X-Jarvis-Key"
echo "  Value: $VOICE_SECRET"
echo "Never share these values in chat."
echo "==============================================="
