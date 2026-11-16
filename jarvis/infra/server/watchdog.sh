#!/usr/bin/env bash
# Every 5 minutes (cron): restart a JARVIS container that is stopped or "unhealthy" (Docker restarts crashed
# containers by itself, but not hung ones), and n8n if its health page stops answering 3 times in a row.
set -uo pipefail
cd /opt/jarvis
LOG=/var/log/jarvis-watchdog.log
for c in $(docker compose ps -a --format '{{.Name}}'); do
  st=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null || echo missing)
  case "$st" in
    running*unhealthy) echo "$(date -Is) $c unhealthy -> restart" >> $LOG; docker restart "$c" >/dev/null ;;
    exited*|dead*|created*) echo "$(date -Is) $c $st -> start" >> $LOG; docker start "$c" >/dev/null ;;
  esac
done
F=/run/jarvis-n8n-fails
if docker compose exec -T n8n wget -q -T 10 -O /dev/null http://127.0.0.1:5678/healthz/readiness 2>/dev/null; then
  echo 0 > $F
else
  n=$(( $(cat $F 2>/dev/null || echo 0) + 1 )); echo $n > $F
  if [ "$n" -ge 3 ]; then echo "$(date -Is) n8n not ready 3 times -> restart" >> $LOG; docker compose restart n8n >/dev/null; echo 0 > $F; fi
fi
