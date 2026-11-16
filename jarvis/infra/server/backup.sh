#!/usr/bin/env bash
# Daily backup (03:30): Postgres dump (all workflows, credentials (encrypted), executions, data tables incl. jarvis_memory)
# + n8n and OmniRoute data + secrets. Keeps 14 days in /opt/jarvis/backups.
# Off-server copy: when offsite-setup.sh was run, the archive is ENCRYPTED (AES-256, key /opt/jarvis/backup.key)
# and sent to the owner's Telegram by the JARVIS bot, with a readable list of the workflows.
set -euo pipefail
cd /opt/jarvis
TS=$(date +%Y%m%d-%H%M)
OUT=/opt/jarvis/backups/jarvis-$TS
mkdir -p "$OUT"
docker compose exec -T postgres pg_dump -U n8n -d n8n | gzip > "$OUT/n8n-db.sql.gz"
for v in n8n_data omniroute-data; do
  docker run --rm -v "jarvis_${v}:/data:ro" -v "$OUT:/out" alpine:3.20 tar -czf "/out/${v}.tar.gz" -C /data .
done
# Workflows as plain JSON too (easy to re-import one workflow without restoring everything)
docker compose exec -T n8n sh -c 'rm -rf /tmp/wf-export && mkdir -p /tmp/wf-export && n8n export:workflow --all --separate --pretty --output=/tmp/wf-export >/dev/null 2>&1 && tar -czf - -C /tmp/wf-export .' > "$OUT/workflows.tar.gz" || echo "workflow export skipped"
cp .env "$OUT/env.backup"; chmod 600 "$OUT/env.backup"
tar -czf "$OUT.tar.gz" -C /opt/jarvis/backups "jarvis-$TS" && rm -rf "$OUT"
find /opt/jarvis/backups -name 'jarvis-*.tar.gz*' -mtime +14 -delete
echo "$(date -Is) backup ok: $OUT.tar.gz ($(du -h "$OUT.tar.gz" | cut -f1))"

# ---- off-server copy (Telegram) ----
TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2- || true)
CHAT=$(grep '^TELEGRAM_CHAT_ID=' .env | cut -d= -f2- || true)
if [ -n "$TOKEN" ] && [ -n "$CHAT" ] && [ -s /opt/jarvis/backup.key ]; then
  ENC="$OUT.tar.gz.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass file:/opt/jarvis/backup.key -in "$OUT.tar.gz" -out "$ENC"
  SIZE=$(stat -c %s "$ENC")
  if [ "$SIZE" -lt 49000000 ]; then
    curl -sS --max-time 300 -F chat_id="$CHAT" -F document=@"$ENC" \
      -F caption="JARVIS backup $TS ($(du -h "$ENC" | cut -f1), encrypted). Keep it. Restore steps: jarvis/infra/server/README.md" \
      "https://api.telegram.org/bot$TOKEN/sendDocument" | grep -q '"ok":true' \
      && echo "$(date -Is) off-server copy sent to Telegram" || echo "$(date -Is) WARNING: Telegram upload failed"
  else
    curl -sS --max-time 60 -d chat_id="$CHAT" \
      --data-urlencode text="⚠️ JARVIS backup $TS is $(du -h "$ENC" | cut -f1): too big for Telegram (50 MB). It is kept on the server for 14 days; turn on Hetzner backups for an off-server copy." \
      "https://api.telegram.org/bot$TOKEN/sendMessage" >/dev/null || true
  fi
  rm -f "$ENC"
fi
