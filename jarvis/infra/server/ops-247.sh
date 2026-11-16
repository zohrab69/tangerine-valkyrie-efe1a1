#!/usr/bin/env bash
# 24/7 checklist for the JARVIS server (safe to run again):
#  - Docker starts at boot; every container has restart: unless-stopped (restarts after a crash or a reboot)
#  - watchdog every 5 minutes (restarts hung/unhealthy containers and a frozen n8n)
#  - nightly backup script updated (off-server copy to Telegram once offsite-setup.sh was run)
#  - prints the address for the outside monitor (UptimeRobot)
#   bash /root/jarvis-server/ops-247.sh
set -euo pipefail
APP=/opt/jarvis
SRC=$(cd "$(dirname "$0")" && pwd)
cp "$SRC/backup.sh" "$SRC/watchdog.sh" "$SRC/offsite-setup.sh" "$APP/"; chmod 700 "$APP/backup.sh" "$APP/watchdog.sh" "$APP/offsite-setup.sh"
systemctl enable docker >/dev/null 2>&1 && echo "OK  Docker starts at boot"
echo '*/5 * * * * root /opt/jarvis/watchdog.sh' > /etc/cron.d/jarvis-watchdog
echo '30 3 * * * root /opt/jarvis/backup.sh >> /var/log/jarvis-backup.log 2>&1' > /etc/cron.d/jarvis-backup
echo "OK  Watchdog every 5 min, backup every night 03:30"
cd "$APP"
bad=0
for c in $(docker compose ps -a --format '{{.Name}}'); do
  p=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$c"); s=$(docker inspect -f '{{.State.Status}}' "$c")
  printf '    %-28s %-10s restart=%s\n' "$c" "$s" "$p"; [ "$p" = "unless-stopped" ] || bad=1
done
[ $bad = 0 ] && echo "OK  All containers restart by themselves" || echo "!!  A container is missing its restart policy"
grep -q '^TELEGRAM_BOT_TOKEN=' .env && echo "OK  Off-server backups to Telegram are on" || echo "--  Off-server backups: not yet. Run: sudo bash /opt/jarvis/offsite-setup.sh"
HOST=$(grep '^N8N_HOST=' .env | cut -d= -f2)
echo
echo "Outside monitor (UptimeRobot, free): add an HTTP(s) monitor for"
echo "    https://$HOST/healthz/readiness"
echo "every 5 minutes, with alerts to your email (and the UptimeRobot app). It warns you if the whole server is down."
