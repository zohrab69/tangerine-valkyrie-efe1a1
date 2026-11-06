#!/usr/bin/env bash
# Daily backup: Postgres dump + n8n and OmniRoute data + secrets. Keeps 14 days in /opt/jarvis/backups.
# Also enable Hetzner's own server backups (Server > Backups) for an off-server copy.
set -euo pipefail
cd /opt/jarvis
TS=$(date +%Y%m%d-%H%M)
OUT=/opt/jarvis/backups/jarvis-$TS
mkdir -p "$OUT"
docker compose exec -T postgres pg_dump -U n8n -d n8n | gzip > "$OUT/n8n-db.sql.gz"
for v in n8n_data omniroute-data; do
  docker run --rm -v "jarvis_${v}:/data:ro" -v "$OUT:/out" alpine:3.20 tar -czf "/out/${v}.tar.gz" -C /data .
done
cp .env "$OUT/env.backup"; chmod 600 "$OUT/env.backup"
tar -czf "$OUT.tar.gz" -C /opt/jarvis/backups "jarvis-$TS" && rm -rf "$OUT"
find /opt/jarvis/backups -name 'jarvis-*.tar.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: $OUT.tar.gz"
