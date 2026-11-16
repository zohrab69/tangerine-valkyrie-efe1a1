# JARVIS cloud server

The server runs n8n (with Postgres), OmniRoute and HTTPS 24/7, so JARVIS keeps working when your laptop is off.

**Recommended plan:** Hetzner Cloud **CX23** (2 vCPU, 4 GB RAM, 40 GB), about €5.49/month plus about €0.50 for the IPv4 address, excluding tax.
Prices were raised in 2026, so confirm them on hetzner.com/cloud before ordering. The CX line is offered in Germany and Finland, which is fine for Canada.
The setup adds 4 GB of swap, so 4 GB of RAM is enough to start. If JARVIS grows, rescale to **CX33** (8 GB, about €8.49) from the Hetzner console.

## 1. On your laptop: create an SSH key (once)
```powershell
ssh-keygen -t ed25519 -C "jarvis"        # press Enter 3 times (default file, no passphrase) or set a passphrase
Get-Content $HOME\.ssh\id_ed25519.pub     # copy this line: it is your PUBLIC key (safe to paste into Hetzner)
```
Never share `id_ed25519` (the file without `.pub`).

## 2. Hetzner Console: create the server
Use **Add Server**, then choose:
- Location: Nuremberg, Falkenstein or Helsinki
- Image: **Ubuntu 24.04**
- Type: **Shared vCPU / Cost-Optimized → CX23**
- Networking: Public IPv4 **on**, IPv6 on
- SSH keys: **Add SSH key**, then paste the line from step 1
- Backups: **on** (about +20%, keeps 7 daily copies off the server)
- Name: `jarvis`

## 3. Copy the setup files and run them (from PowerShell)
```powershell
$IP = "PUT-SERVER-IP-HERE"
scp -r $HOME\jarvis-repo\jarvis\infra\server root@${IP}:/root/jarvis-server
ssh root@$IP "bash /root/jarvis-server/setup.sh"
```
Type `yes` the first time SSH asks about the fingerprint. The setup takes 5-10 minutes and ends by printing your n8n address,
`https://n8n.<ip-with-dashes>.sslip.io`. sslip.io gives a free address with HTTPS and no domain purchase. It can be switched to your
store's domain later.

## 4. After setup
- Open the n8n address and create the owner account, using a new strong password.
- Copy `/opt/jarvis/.env` into your password manager. It holds the encryption keys:
  `ssh root@$IP "cat /opt/jarvis/.env"`
- Open the OmniRoute dashboard privately through an SSH tunnel. Keep this window open while you use it:
  `ssh -L 20128:localhost:20128 root@$IP`, then browse to http://localhost:20128
- From n8n, OmniRoute's address is `http://omniroute:20128/v1`.

## Everyday
| To do this | Run |
|---|---|
| Status | `ssh root@$IP "cd /opt/jarvis && docker compose ps && free -h"` |
| Backup now | `ssh root@$IP /opt/jarvis/backup.sh` |
| Logs | `ssh root@$IP "cd /opt/jarvis && docker compose logs --tail 50 n8n"` |
| 24/7 check | `ssh root@$IP "bash /root/jarvis-server/ops-247.sh"` |
| Watchdog log | `ssh root@$IP "tail /var/log/jarvis-watchdog.log"` |

## 24/7 without the laptop
Everything runs on this server. The laptop is only for building.
- **Auto-restart:** Docker starts at boot and every container has `restart: unless-stopped` (n8n, Postgres, OmniRoute, voice and video service, Caddy for the screen).
- **Watchdog** (`watchdog.sh`, every 5 minutes): restarts a container that is stopped or "unhealthy", and n8n if its health page stops answering 3 times in a row.
- **Outside watchdog:** UptimeRobot (free) checks `https://n8n.<ip-with-dashes>.sslip.io/healthz/readiness` every 5 minutes and emails you (and its phone app notifies you) if the whole server is down.
- **Health checks inside:** Alerts v2 sends a Telegram alert when a workflow fails, when a key stops working, or when the daily research did not go out.
- **Backups:** every night at 03:30, 14 days kept on the server. With `offsite-setup.sh`, each backup is also **encrypted** and sent to your Telegram (off-server copy).
  Turning on Hetzner's own backups (Server > Backups, about +20%) adds a second off-server copy.

Set up (once, from PowerShell):
```powershell
ssh root@$IP "bash /root/jarvis-server/ops-247.sh"
ssh -t root@$IP "bash /opt/jarvis/offsite-setup.sh"
```
`offsite-setup.sh` asks for the JARVIS bot token without showing it on screen (paste it there, never in a chat), then prints a **backup key**.
Save that key in your password manager: without it the backup files cannot be opened.

### Restore from a Telegram backup
1. Download the `.enc` file from Telegram, copy it to the server: `scp jarvis-XXXX.tar.gz.enc root@${IP}:/root/`
2. Decrypt: `ssh root@$IP "openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:/opt/jarvis/backup.key -in /root/jarvis-XXXX.tar.gz.enc -out /root/restore.tar.gz"`
   (on a new server, first put the saved key into `/opt/jarvis/backup.key`)
3. Inside: `n8n-db.sql.gz` (all workflows, credentials, data tables), `n8n_data` and `omniroute-data` volumes, `env.backup` (secrets), and `workflows.tar.gz` (each workflow as JSON, importable one by one). Ask Claude for the full restore steps for your case.

## JARVIS screen (voice)
A password-protected page at `https://jarvis.<ip-with-dashes>.sslip.io`, with hold-to-talk (Chrome or Edge), spoken replies, conversation, today's stats and pending approvals.
```powershell
cd $HOME\jarvis-repo; git pull
scp -r $HOME\jarvis-repo\jarvis\infra\server\* root@${IP}:/root/jarvis-server/
ssh root@$IP "bash /root/jarvis-server/voice-setup.sh"
```
The script prints the address, the username (`owner`), a new password, and the key for the n8n Webhook credential. Save them in your password manager.
Then import `workflows/jarvis-brain-v1.json` in n8n (it answers the screen and Telegram), set its credentials and publish it.
Re-running `voice-setup.sh` also rebuilds the voice service (now with the video maker) and keeps your password and key.
Voice recognition uses Chrome's built-in service, which sends your audio to Google. Typing always works.
