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
