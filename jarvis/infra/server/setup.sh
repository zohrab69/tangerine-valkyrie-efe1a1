#!/usr/bin/env bash
# JARVIS server setup for a fresh Hetzner Ubuntu 24.04 server. Safe to run again.
#   Usage (as root on the server):  bash setup.sh
# Does: updates, firewall (22/80/443 only), SSH key-only login, 4 GB swap, automatic
# security updates, Docker, secrets in /opt/jarvis/.env, starts the stack, daily backups.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root"; exit 1; }
cd "$(dirname "$0")"
APP=/opt/jarvis
N8N_VERSION_DEFAULT=2.45.7

echo "==> System updates and basic tools"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
APT_OPTS=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
apt-get update -q
apt-get upgrade "${APT_OPTS[@]}"
apt-get install "${APT_OPTS[@]}" ufw unattended-upgrades curl ca-certificates openssl

echo "==> Automatic security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Firewall: allow only SSH, HTTP, HTTPS"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> SSH: keys only (no passwords)"
if [ -s /root/.ssh/authorized_keys ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/99-jarvis.conf
  systemctl reload ssh || systemctl reload sshd || true
else
  echo "   WARNING: no SSH key found for root; leaving password login unchanged."
fi

echo "==> Swap (4 GB) so memory spikes slow down instead of crashing"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null; echo 'vm.swappiness=10' > /etc/sysctl.d/99-jarvis.conf
fi

echo "==> Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install "${APT_OPTS[@]}" docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Docker publishes ports past ufw; only Caddy publishes publicly, OmniRoute binds 127.0.0.1.

echo "==> App folder and secrets"
mkdir -p "$APP/backups"
cp compose.yml "$APP/compose.yml"
cp backup.sh "$APP/backup.sh"; chmod 700 "$APP/backup.sh"
if [ ! -f "$APP/.env" ]; then
  IP=$(curl -fsS -4 https://api.ipify.org || hostname -I | awk '{print $1}')
  sec() { openssl rand -hex 32; }
  umask 077
  cat > "$APP/.env" <<ENV
# JARVIS server secrets. Copy this file somewhere safe (password manager).
# Losing N8N_ENCRYPTION_KEY or OR_STORAGE_ENCRYPTION_KEY = saved credentials cannot be read.
N8N_HOST=n8n.${IP//./-}.sslip.io
N8N_VERSION=${N8N_VERSION_DEFAULT}
OMNIROUTE_VERSION=3.8.53
POSTGRES_PASSWORD=$(sec)
N8N_ENCRYPTION_KEY=$(sec)
OR_JWT_SECRET=$(sec)
OR_API_KEY_SECRET=$(sec)
OR_STORAGE_ENCRYPTION_KEY=$(sec)
ENV
  echo "   Created $APP/.env"
else
  echo "   $APP/.env exists - keeping secrets"
fi

echo "==> Starting JARVIS (first time: a few minutes)"
cd "$APP"
docker compose config --quiet
docker compose pull -q
docker compose up -d

echo "==> Daily backup at 03:30 (keeps 14 days)"
echo '30 3 * * * root /opt/jarvis/backup.sh >> /var/log/jarvis-backup.log 2>&1' > /etc/cron.d/jarvis-backup

HOST=$(grep '^N8N_HOST=' "$APP/.env" | cut -d= -f2)
echo
echo "Done. Waiting for HTTPS certificate and n8n..."
for i in $(seq 1 60); do
  if curl -fsS "https://$HOST/healthz" >/dev/null 2>&1; then echo "n8n is live: https://$HOST"; break; fi
  sleep 5
done
docker compose ps
free -h
echo
echo "Next: open https://$HOST to create the n8n owner account."
echo "OmniRoute dashboard: on your laptop run  ssh -L 20128:localhost:20128 root@<server-ip>  then open http://localhost:20128"
