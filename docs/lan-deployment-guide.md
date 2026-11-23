# Self-Hosted LAN Deployment & Certificate Guide (`lockin.home.arpa`)

LOCKIN is designed to run on your local network (LAN) without requiring a purchased public domain name.

---

## 1. Reserve a Static LAN IP & Map `lockin.home.arpa`

1. Find your host PC's LAN IPv4 address (e.g. `192.168.68.57`) by running `ipconfig` in PowerShell.
2. In your home/campus router's DHCP settings, reserve that IP address for your PC's MAC address so it never changes.
3. Add a local DNS record in your router mapping **`lockin.home.arpa`** → your host PC's LAN IP.
   - **Alternative (per-device hosts file):**
     - **Windows:** Add `192.168.68.57 lockin.home.arpa` to `C:\Windows\System32\drivers\etc\hosts` (as Administrator).
     - **macOS / Linux:** Add `192.168.68.57 lockin.home.arpa` to `/etc/hosts`.

---

## 2. Start the Production Stack

```powershell
docker compose -f infra/compose/docker-compose.prod.yml --env-file .env up -d --build
pnpm db:bootstrap
pnpm db:migrate
pnpm db:seed
```

---

## 3. Trust Caddy's Local Root Certificate (One-Time per Device)

Because `lockin.home.arpa` is a private LAN domain, Caddy generates its own Root Certificate Authority (`tls internal`).

1. Export the root certificate from the Caddy container:
   ```powershell
   docker cp lockin-prod-caddy-1:/data/caddy/pki/authorities/local/root.crt .\lockin-lan-root.crt
   ```
2. Install `lockin-lan-root.crt` on each device that accesses `https://lockin.home.arpa`:
   - **Windows:** Double-click `lockin-lan-root.crt` → **Install Certificate** → **Local Machine** → **Place all certificates in the following store** → **Trusted Root Certification Authorities**.
   - **Android:** Settings → Security & Privacy → More security settings → Install a certificate → **CA certificate** → select `lockin-lan-root.crt`.
   - **iOS / iPadOS:** AirDrop or email `lockin-lan-root.crt` → Settings → Profile Downloaded → Install → then go to Settings → General → About → **Certificate Trust Settings** and toggle full trust ON.
   - **macOS:** Double-click `lockin-lan-root.crt` → Keychain Access → System keychain → double-click the certificate → Trust → **Always Trust**.

---

## 4. Automated Backups & Restore Drill

- **Create a backup:**
  ```powershell
  .\infra\scripts\backup.ps1
  ```
- **Restore from a backup:**
  ```powershell
  .\infra\scripts\restore.ps1 -BackupFile .\backups\lockin-YYYYMMDD-HHMMSS.sql
  ```
