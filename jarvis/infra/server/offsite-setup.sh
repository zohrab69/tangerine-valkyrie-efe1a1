#!/usr/bin/env bash
# One-time: send each daily backup, encrypted, to your Telegram (off-server copy, free).
# Asks for the JARVIS bot token WITHOUT showing it (paste it here on the server, never in a chat).
#   sudo bash /opt/jarvis/offsite-setup.sh
set -euo pipefail
cd /opt/jarvis
read -r -s -p "Paste the JARVIS Telegram bot token (from @BotFather), then Enter: " TOKEN; echo
[ -n "$TOKEN" ] || { echo "No token given, nothing changed."; exit 1; }
CHAT=${TELEGRAM_CHAT_ID:-6203634137}
sed -i '/^TELEGRAM_BOT_TOKEN=/d;/^TELEGRAM_CHAT_ID=/d' .env
printf 'TELEGRAM_BOT_TOKEN=%s\nTELEGRAM_CHAT_ID=%s\n' "$TOKEN" "$CHAT" >> .env
chmod 600 .env
if [ ! -s backup.key ]; then
  umask 077; openssl rand -base64 48 | tr -d '\n' > backup.key
  echo; echo "==> NEW backup key (needed to open the backups). Copy it NOW into your password manager:"
  echo; cat backup.key; echo; echo
  read -r -p "Press Enter once you have saved it... " _
fi
curl -sS --max-time 30 -d chat_id="$CHAT" --data-urlencode text="✅ JARVIS off-server backups are on: every night at 03:30 you get an encrypted backup file here." \
  "https://api.telegram.org/bot$TOKEN/sendMessage" | grep -q '"ok":true' && echo "Telegram test message sent." || { echo "Telegram did not accept the token. Run this script again."; exit 1; }
echo "Running a backup now (1-3 minutes)..."
/opt/jarvis/backup.sh
