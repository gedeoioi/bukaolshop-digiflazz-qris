# Deploy bukaolshop-digiflazz-qris ke VPS

Panduan lengkap dari nol sampai production.

---

## Daftar Isi

1. [Persiapan VPS](#1-persiapan-vps)
2. [Install Docker & Docker Compose](#2-install-docker--docker-compose)
3. [Setup Akses Public (Pilih Salah Satu)](#3-setup-akses-public-pilih-salah-satu)
4. [Buat Telegram Bot](#4-buat-telegram-bot)
5. [Daftar & Konfigurasi Digiflazz API](#5-daftar--konfigurasi-digiflazz-api)
6. [Clone Project ke VPS](#6-clone-project-ke-vps)
7. [Konfigurasi Environment](#7-konfigurasi-environment)
8. [Build & Jalankan Aplikasi](#8-build--jalankan-aplikasi)
9. [Setup Nginx Reverse Proxy + SSL](#9-setup-nginx-reverse-proxy--ssl)
10. [Setup Firewall](#10-setup-firewall)
11. [Setup Auto Backup Database](#11-setup-auto-backup-database)
12. [Setup Auto Restart & Monitoring](#12-setup-auto-restart--monitoring)
13. [Konfigurasi Webhook External](#13-konfigurasi-webhook-external)
14. [Perintah Operasional Sehari-hari](#14-perintah-operasional-sehari-hari)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Persiapan VPS

### Spesifikasi Minimum

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 1 GB | 2 GB |
| CPU | 1 Core | 2 Core |
| Storage | 20 GB SSD | 40 GB SSD |

Rekomendasi provider VPS: DigitalOcean, Vultr, Hetzner, Linode, AWS Lightsail.

### Akses VPS via SSH

```bash
ssh root@IP_VPS_ANDA
```

### Update System

```bash
apt update && apt upgrade -y
```

### Install Paket Dasar

```bash
apt install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release software-properties-common
```

### Buat User Non-Root (Opsional tapi Direkomendasikan)

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Setelah itu login sebagai user `deploy`:
```bash
ssh deploy@IP_VPS_ANDA
```

---

## 2. Install Docker & Docker Compose

### Install Docker

```bash
# Tambah Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Tambah repository Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Tambah User ke Group Docker (agar tidak perlu sudo)

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Verifikasi Installasi

```bash
docker --version
docker compose version
```

### Start Docker otomatis saat boot

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 3. Setup Akses Public (Pilih Salah Satu)

Aplikasi ini butuh URL public agar webhook dari BukaOlshop, Digiflazz, dan payment gateway bisa mengirim data ke server Anda. Ada 3 opsi:

### Opsi A: Tanpa Domain — Pakai IP VPS Langsung (Paling Mudah)

Tidak perlu beli domain. Langsung pakai IP VPS.

**Kelebihan:** Gratis, langsung jalan.
**Kekurangan:** Tidak bisa pakai HTTPS (SSL), URL kurang profesional.

Catat IP VPS Anda:
```
Contoh: 123.456.789.0
```

URL webhook Anda akan menjadi:
```
http://123.456.789.0:3000/api/webhook/bukaolshop
http://123.456.789.0:3000/api/webhook/digiflazz
http://123.456.789.0:3000/api/webhook/payment
```

**Langkah:** Lanjut ke langkah 4 (tidak perlu setup DNS/Nginx/SSL). Aplikasi bisa diakses langsung di `http://IP_VPS:3000`.

> **Catatan:** Beberapa payment provider **mewajibkan HTTPS**. Jika payment provider Anda mensyaratkan HTTPS, gunakan Opsi B atau C.

---

### Opsi B: Domain Gratis dari freedns.afraid.org / DuckDNS / No-IP (Gratis + Bisa HTTPS)

**Kelebihan:** Gratis, bisa pakai HTTPS.
**Kekurangan:** Subdomain kurang profesional, perlu perpanjang manual.

#### Step 1: Daftar dan Buat Subdomain

**DuckDNS** (paling mudah):
1. Buka https://www.duckdns.org
2. Login dengan Google/GitHub
3. Buat subdomain, contoh: `bukaolshop-app.duckdns.org`
4. Isi IP VPS Anda di kolom IP
5. Klik "update"

**No-IP** (alternatif):
1. Buka https://www.noip.com
2. Daftar akun gratis
3. Buat hostname, contoh: `bukaolshop-app.ddns.net`
4. Set IP ke VPS Anda

#### Step 2: Verifikasi DNS

```bash
# Tunggu 1-2 menit, lalu cek
ping bukaolshop-app.duckdns.org
# Harus resolve ke IP VPS Anda
```

#### Step 3: Lanjut ke langkah 8 untuk setup Nginx + SSL

Gunakan `bukaolshop-app.duckdns.org` sebagai `server_name` di Nginx.

---

### Opsi C: Beli Domain Sendiri (Rekomendasi untuk Production)

**Kelebihan:** Profesional, HTTPS, full kontrol.
**Kekurangan:** Bayar ~Rp 100-150rb/tahun.

#### Step 1: Beli Domain

Beli dari: Cloudflare (paling murah), Namecheap, Niagahoster, Domainesia.

#### Step 2: Konfigurasi DNS

Tambah DNS record di panel domain:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `IP_VPS_ANDA` | 300 |
| A | `api` | `IP_VPS_ANDA` | 300 |

Contoh: domain `domainanda.com`:
- `domainanda.com` → IP VPS
- `api.domainanda.com` → IP VPS (untuk webhook)

#### Step 3: Verifikasi DNS

Tunggu 5-15 menit:
```bash
dig api.domainanda.com +short
# Output: IP_VPS_ANDA
```

#### Step 4: Lanjut ke langkah 8 untuk setup Nginx + SSL

---

## 4. Buat Telegram Bot

Bot Telegram digunakan untuk:
- Menerima notifikasi order, pembayaran, dan transaksi
- Cek saldo Digiflazz
- Cek status order/transaksi
- Laporan harian
- Sinkronisasi produk

### Step 1: Buat Bot via BotFather

1. Buka Telegram, cari **@BotFather** (pastikan centang biru/verified)
2. Kirim perintah: `/newbot`
3. BotFather akan minta:
   - **Nama bot**: `BukaOlshop Bot` (bebas, ini display name)
   - **Username bot**: `bukaolshop_xxx_bot` (harus unik, harus diakhiri `bot`)
4. BotFather akan memberikan **TOKEN** seperti:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
5. **CATAT TOKEN INI** — ini yang dimasukkan ke `.env` sebagai `TELEGRAM_BOT_TOKEN`

### Step 2: Dapatkan Telegram User ID Anda

Bot ini hanya bisa diakses oleh admin. Anda perlu tahu Telegram User ID Anda.

1. Buka Telegram, cari **@userinfobot**
2. Kirim pesan apapun ke bot tersebut
3. Bot akan membalas dengan info Anda, catat angka di `Id:` — ini adalah **Telegram User ID** Anda
   ```
   Id: 123456789
   ```

Jika ada beberapa admin, minta masing-masing kirim pesan ke @userinfobot.

### Step 3: Konfigurasi di .env

Nanti di langkah 6, isi `.env` dengan:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_IDS=123456789,987654321
```

- `TELEGRAM_BOT_TOKEN` = token dari BotFather
- `TELEGRAM_ADMIN_IDS` = Telegram User ID (bisa lebih dari 1, pisahkan koma)

### Step 4: Matikan Privacy Mode (Penting!)

Agar bot bisa membaca semua pesan di grup (jika diperlukan):

1. Buka chat dengan **@BotFather**
2. Kirim: `/mybots`
3. Pilih bot Anda
4. Pilih **Bot Settings** → **Group Privacy**
5. Pilih **Turn off** (disable privacy mode)

> **Catatan:** Bot ini menggunakan mode **polling** (bukan webhook). Artinya bot aktif mengecek pesan baru secara periodik. Tidak perlu setup webhook Telegram — bot akan langsung merespon begitu container dijalankan.

### Step 5: Test Bot (Setelah Deploy)

Setelah aplikasi berjalan (langkah 7), buka Telegram:
1. Cari username bot Anda (contoh: `@bukaolshop_xxx_bot`)
2. Kirim `/start`
3. Kirim `/menu` — harus muncul menu inline
4. Kirim `/saldo` — harus muncul saldo Digiflazz (jika sudah dikonfigurasi)

---

## 5. Daftar & Konfigurasi Digiflazz API

Digiflazz adalah supplier digital produk (pulsa, paket data, token listrik, voucher game, dll). Aplikasi ini terhubung ke API Digiflazz untuk:
- Mengecek saldo deposit
- Mengambil daftar produk (pricelist)
- Membuat transaksi top-up
- Menerima callback status transaksi via webhook

### Step 1: Daftar Akun Digiflazz

1. Buka https://digiflazz.com
2. Klik **Daftar** atau **Register**
3. Isi data: nama, email, nomor HP, password
4. Verifikasi email dan nomor HP
5. Login ke dashboard

### Step 2: Dapatkan Credentials

Setelah login di dashboard Digiflazz:

1. Buka menu **Pengaturan** atau **Settings** → **API**
2. Anda akan melihat:
   - **Username** — username akun Digiflazz Anda
   - **API Key** — string acak untuk autentikasi API
3. **CATAT KEDUA VALUE INI** — ini yang dimasukkan ke `.env`

Contoh:
```
Username: tokosaya
API Key: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 3: Top Up Deposit

Sebelum bisa bertransaksi, Anda harus punya saldo deposit di Digiflazz.

1. Di dashboard Digiflazz, buka menu **Deposit**
2. Pilih metode: Transfer Bank, Virtual Account, atau QRIS
3. Transfer sesuai nominal yang diinginkan
4. Tunggu konfirmasi (biasanya instan untuk VA/QRIS)
5. Saldo akan muncul di dashboard

**Minimum deposit:** Rp 10.000 (bervariasi, cek dashboard)

### Step 4: Set Callback URL (Webhook)

Agar aplikasi menerima notifikasi otomatis saat transaksi selesai:

1. Di dashboard Digiflazz, buka **Pengaturan** → **Callback URL**
2. Isi dengan URL webhook Anda:

| Opsi Akses | Callback URL |
|------------|-------------|
| Opsi A (IP langsung) | `http://IP_VPS:3000/api/webhook/digiflazz` |
| Opsi B (DuckDNS) | `https://bukaolshop-app.duckdns.org/api/webhook/digiflazz` |
| Opsi C (Domain) | `https://api.domainanda.com/api/webhook/digiflazz` |

3. Simpan

> **Catatan:** Callback URL baru bisa diisi setelah aplikasi berjalan di VPS (langkah 8). Untuk sementara, skip step ini dan kembali lagi setelah deploy.

### Step 5: Konfigurasi di .env

Di langkah 7 nanti, isi `.env` dengan:

```env
DIGIFLAZZ_USERNAME=tokosaya
DIGIFLAZZ_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
DIGIFLAZZ_BASE_URL=https://api.digiflazz.com
DIGIFLAZZ_WEBHOOK_SECRET=
```

- `DIGIFLAZZ_USERNAME` = username dari dashboard Digiflazz
- `DIGIFLAZZ_API_KEY` = API key dari dashboard Digiflazz
- `DIGIFLAZZ_BASE_URL` = `https://api.digiflazz.com` (jangan diubah)
- `DIGIFLAZZ_WEBHOOK_SECRET` = kosongkan jika tidak dipakai (opsional, untuk verifikasi signature webhook)

### Step 6: Test Koneksi (Setelah Deploy)

Setelah aplikasi berjalan (langkah 8), test koneksi Digiflazz:

**Via Telegram Bot:**
```
/saldo
```
Bot akan membalas dengan saldo deposit Digiflazz Anda.

**Via curl:**
```bash
curl http://localhost:3000/health
```
Response harus menampilkan `"digiflazz": "configured"`.

**Sinkronisasi produk pertama kali:**
```
/sync
```
di Telegram bot. Ini akan mengambil semua produk dari Digiflazz dan menyimpannya ke database.

### Cara Kerja Integrasi Digiflazz

Aplikasi ini menggunakan API Digiflazz dengan alur:

```
1. Customer order di BukaOlshop
   ↓
2. Aplikasi buat transaksi ke Digiflazz API (/v1/transaction)
   ↓
3. Digiflazz proses top-up ke nomor customer
   ↓
4. Digiflazz kirim callback ke webhook URL (/api/webhook/digiflazz)
   ↓
5. Aplikasi update status order & kirim notifikasi Telegram
```

**Autentikasi API** menggunakan MD5 signature:
```
sign = MD5(username + api_key + ref_id)
```
Ini sudah ditangani otomatis oleh `src/integrations/digiflazz/client.ts`.

### Endpoint API Digiflazz yang Digunakan

| Endpoint | Fungsi | File |
|----------|--------|------|
| `POST /v1/cek-saldo` | Cek saldo deposit | `client.ts:40` |
| `POST /v1/price-list` | Ambil daftar produk | `client.ts:50` |
| `POST /v1/transaction` | Buat transaksi baru | `client.ts:66` |
| `POST /v1/transaction` | Cek status transaksi | `client.ts:88` |

---

## 6. Clone Project ke VPS

### Clone Repository

```bash
cd /home/deploy  # atau /root jika pakai root
git clone https://github.com/USERNAME_ANDA/bukaolshop-digiflazz-qris.git
cd bukaolshop-digiflazz-qris
```

**Jika repository private**, setup SSH key atau personal access token:
```bash
# Opsi 1: Personal Access Token
git clone https://USERNAME:TOKEN@github.com/USERNAME_ANDA/bukaolshop-digiflazz-qris.git

# Opsi 2: SSH Key
ssh-keygen -t ed25519 -C "deploy@vps"
cat ~/.ssh/id_ed25519.pub
# Copy output, tambahkan ke GitHub > Settings > SSH Keys
git clone git@github.com:USERNAME_ANDA/bukaolshop-digiflazz-qris.git
```

### Buat Direktori yang Dibutuhkan

```bash
mkdir -p mysql-conf
```

---

## 7. Konfigurasi Environment

### Buat File .env

```bash
cp .env.example .env
nano .env
```

### Isi Semua Environment Variable

```env
# ============================================
# APPLICATION
# ============================================
NODE_ENV=production
PORT=3000
API_PREFIX=/api

# ============================================
# DATABASE (otomatis oleh docker-compose, tapi tulis manual untuk jaga-jaga)
# ============================================
DATABASE_URL="mysql://root:GANTI_PASSWORD_ROOT_MYSQL@mysql:3306/bukaolshop_db"

# ============================================
# MYSQL (untuk docker-compose)
# ============================================
MYSQL_ROOT_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT_1
MYSQL_DATABASE=bukaolshop_db
MYSQL_USER=appuser
MYSQL_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT_2

# ============================================
# BUKAOLSHOP
# ============================================
BUKAOLSHOP_API_URL=https://api.bukaolshop.com/v1
BUKAOLSHOP_API_KEY=isi_dari_bukaolshop
BUKAOLSHOP_WEBHOOK_SECRET=isi_dari_bukaolshop

# ============================================
# DIGIFLAZZ
# ============================================
DIGIFLAZZ_USERNAME=isi_dari_digiflazz
DIGIFLAZZ_API_KEY=isi_dari_digiflazz
DIGIFLAZZ_BASE_URL=https://api.digiflazz.com
DIGIFLAZZ_WEBHOOK_SECRET=isi_dari_digiflazz

# ============================================
# PAYMENT GATEWAY (QRIS)
# ============================================
PAYMENT_PROVIDER=isi_nama_provider
PAYMENT_API_URL=isi_url_api_payment
PAYMENT_API_KEY=isi_api_key_payment
PAYMENT_MERCHANT_ID=isi_merchant_id
PAYMENT_WEBHOOK_SECRET=isi_webhook_secret
PAYMENT_CALLBACK_URL=https://api.domainanda.com/api/webhook/payment

# ============================================
# TELEGRAM (dari langkah 4)
# ============================================
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_IDS=123456789,987654321

# ============================================
# SECURITY
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### Contoh .env untuk Setiap Opsi Akses

**Opsi A (IP langsung, tanpa domain):**
```env
PAYMENT_CALLBACK_URL=http://123.456.789.0:3000/api/webhook/payment
```

**Opsi B (DuckDNS gratis):**
```env
PAYMENT_CALLBACK_URL=https://bukaolshop-app.duckdns.org/api/webhook/payment
```

**Opsi C (Domain sendiri):**
```env
PAYMENT_CALLBACK_URL=https://api.domainanda.com/api/webhook/payment
```

### Tips Generate Password Kuat

```bash
openssl rand -base64 32
```

**PENTING**: 
- `DATABASE_URL` di dalam container, hostname MySQL adalah `mysql` (nama service di docker-compose), BUKAN `localhost`.
- `MYSQL_ROOT_PASSWORD` harus sama dengan password di `DATABASE_URL`.
- `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_ADMIN_IDS` wajib diisi agar bot berfungsi.

### Simpan dan Keluar

Tekan `Ctrl+X`, lalu `Y`, lalu `Enter`.

---

## 8. Build & Jalankan Aplikasi

### Build Docker Image dan Jalankan

```bash
docker compose up -d --build
```

Proses ini akan:
1. Build image Node.js (multi-stage build)
2. Pull image MySQL 8.0
3. Jalankan MySQL container
4. Jalankan App container (setelah MySQL sehat)
5. Prisma migrate otomatis saat container start (via entrypoint.sh)

### Cek Status Container

```bash
docker compose ps
```

Output yang diharapkan:
```
NAME                STATUS                  PORTS
bukaolshop-mysql    running (healthy)       0.0.0.0:3306->3306/tcp
bukaolshop-app      running (healthy)       0.0.0.0:3000->3000/tcp
```

### Cek Log Aplikasi

```bash
# Semua log
docker compose logs -f

# Hanya app
docker compose logs -f app

# Hanya MySQL
docker compose logs -f mysql

# 100 baris terakhir app
docker compose logs --tail 100 app
```

### Jalankan Database Migration (Jika Tidak Otomatis)

```bash
docker compose exec app npx prisma migrate deploy
```

### Verifikasi Health Check

```bash
curl http://localhost:3000/health
```

Expected output:
```json
{
  "status": "ok",
  "database": "connected",
  "telegram": "configured",
  "bukaolshop": "configured",
  "digiflazz": "configured",
  "payment": "configured",
  "timestamp": "2026-08-27T...",
  "uptime": 123.456
}
```

**Jika database "error"**, tunggu beberapa detik dan cek lagi — MySQL mungkin masih dalam proses inisialisasi.

### Verifikasi Telegram Bot

Cek log app, harus ada:
```
Telegram bot started
```

Buka Telegram, kirim `/start` ke bot Anda. Jika bot merespon, bot sudah berjalan.

---

## 9. Setup Nginx Reverse Proxy + SSL

> **Lewati langkah ini jika pakai Opsi A (IP langsung tanpa domain).**

### Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Install Certbot (Let's Encrypt SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Buat Nginx Config

```bash
sudo nano /etc/nginx/sites-available/bukaolshop
```

**Untuk Opsi C (domain sendiri):**
```nginx
server {
    listen 80;
    server_name api.domainanda.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
```

**Untuk Opsi B (DuckDNS):**
```nginx
server {
    listen 80;
    server_name bukaolshop-app.duckdns.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
```

### Aktifkan Config

```bash
sudo ln -s /etc/nginx/sites-available/bukaolshop /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Install SSL Certificate

**Domain sendiri:**
```bash
sudo certbot --nginx -d api.domainanda.com
```

**DuckDNS:**
```bash
sudo certbot --nginx -d bukaolshop-app.duckdns.org
```

Ikuti prompt:
1. Masukkan email
2. Setuju ToS (Y)
3. Pilih redirect HTTP ke HTTPS (2)

### Verifikasi Auto-Renewal SSL

```bash
sudo certbot renew --dry-run
```

### Verifikasi

```bash
curl -I https://api.domainanda.com/health
# atau
curl -I https://bukaolshop-app.duckdns.org/health
```

---

## 10. Setup Firewall

### Konfigurasi UFW

**Jika pakai Nginx (Opsi B atau C):**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

**Jika pakai IP langsung (Opsi A):**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Verifikasi

```bash
sudo ufw status verbose
```

**PENTING**: Jangan buka port 3306 (MySQL) ke public! Akses database hanya dari dalam server.

---

## 11. Setup Auto Backup Database

### Buat Script Backup untuk Docker

```bash
nano scripts/backup-docker.sh
```

Isi:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/bukaolshop"
DATE=$(date +%Y-%m-%d_%H-%M)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Load .env
if [ -f /home/deploy/bukaolshop-digiflazz-qris/.env ]; then
    source /home/deploy/bukaolshop-digiflazz-qris/.env
fi

docker exec bukaolshop-mysql mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" bukaolshop_db | gzip > "$BACKUP_DIR/backup-$DATE.sql.gz"

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup successful: backup-$DATE.sql.gz"
else
    echo "[$(date)] Backup FAILED!"
    exit 1
fi

find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Old backups cleaned (retention: $RETENTION_DAYS days)"
```

```bash
chmod +x scripts/backup-docker.sh
```

### Test Backup Manual

```bash
./scripts/backup-docker.sh
ls -la /var/backups/bukaolshop/
```

### Setup Cron Job (Auto Backup Setiap Jam 2 Pagi)

```bash
crontab -e
```

Tambahkan baris:

```
0 2 * * * /home/deploy/bukaolshop-digiflazz-qris/scripts/backup-docker.sh >> /var/log/bukaolshop-backup.log 2>&1
```

---

## 12. Setup Auto Restart & Monitoring

### Docker Restart Policy

Sudah diatur di `docker-compose.yml` dengan `restart: unless-stopped`. Container akan otomatis restart jika crash atau VPS reboot.

### Setup Log Rotation untuk Docker

```bash
sudo nano /etc/docker/daemon.json
```

Isi:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
```

### Monitoring Sederhana dengan Script

```bash
nano scripts/health-check.sh
```

Isi:

```bash
#!/bin/bash

HEALTH_URL="http://localhost:3000/health"
TELEGRAM_BOT_TOKEN="ISI_TOKEN_BOT"
TELEGRAM_CHAT_ID="ISI_CHAT_ID_ADMIN"

response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$response" != "200" ]; then
    message="ALERT: bukaolshop-app DOWN! HTTP Status: $response"
    echo "[$(date)] $message"
    
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$message" > /dev/null
    
    cd /home/deploy/bukaolshop-digiflazz-qris
    docker compose restart app
else
    echo "[$(date)] Health check OK"
fi
```

```bash
chmod +x scripts/health-check.sh
```

Tambahkan ke cron (cek setiap 5 menit):

```bash
crontab -e
```

```
*/5 * * * * /home/deploy/bukaolshop-digiflazz-qris/scripts/health-check.sh >> /var/log/bukaolshop-health.log 2>&1
```

---

## 13. Konfigurasi Webhook External

### BukaOlshop Webhook

Di dashboard BukaOlshop, set webhook URL ke:
```
https://api.domainanda.com/api/webhook/bukaolshop
```
Atau (Opsi A): `http://IP_VPS:3000/api/webhook/bukaolshop`
Atau (Opsi B): `https://bukaolshop-app.duckdns.org/api/webhook/bukaolshop`

### Digiflazz Webhook

Di dashboard Digiflazz, set callback URL ke:
```
https://api.domainanda.com/api/webhook/digiflazz
```

### Payment (QRIS) Webhook

Di dashboard payment provider, set callback URL ke:
```
https://api.domainanda.com/api/webhook/payment
```

### Telegram Bot

**Tidak perlu setup webhook Telegram.** Bot ini menggunakan mode **polling** (via Telegraf `bot.launch()`), artinya bot aktif mengecek pesan baru dari server Telegram secara periodik. Begitu container app berjalan, bot langsung aktif dan merespon perintah.

---

## 14. Perintah Operasional Sehari-hari

### Cek Status

```bash
cd /home/deploy/bukaolshop-digiflazz-qris
docker compose ps
```

### Lihat Log Real-time

```bash
docker compose logs -f app
```

### Restart Aplikasi

```bash
docker compose restart app
```

### Restart Semua (Termasuk MySQL)

```bash
docker compose restart
```

### Stop Aplikasi

```bash
docker compose down
```

### Update Aplikasi (Pull & Rebuild)

```bash
cd /home/deploy/bukaolshop-digiflazz-qris
git pull origin main
docker compose up -d --build
```

### Masuk ke Container App (Debug)

```bash
docker compose exec app sh
```

### Masuk ke MySQL CLI

```bash
docker compose exec mysql mysql -u root -p bukaolshop_db
```

### Cek Resource Usage

```bash
docker stats
```

### Cleanup Docker (Jika Disk Penuh)

```bash
# Lebih aman — hapus hanya image/container lama
docker image prune -a
docker container prune
```

---

## 15. Troubleshooting

### Container App Terus Restart

```bash
docker compose logs app
```

Kemungkinan penyebab:
- `.env` salah (terutama `DATABASE_URL`)
- MySQL belum siap (tunggu 30 detik)
- Port 3000 sudah dipakai proses lain

### Database Connection Error

```bash
docker compose exec mysql mysqladmin ping -u root -p
docker compose exec app printenv DATABASE_URL
```

### Telegram Bot Tidak Merespon

1. Cek log: `docker compose logs app | grep -i telegram`
2. Pastikan `TELEGRAM_BOT_TOKEN` benar (cek di BotFather)
3. Pastikan `TELEGRAM_ADMIN_IDS` berisi User ID Anda (bukan username)
4. Kirim `/start` ke bot di Telegram
5. Jika bot baru dibuat, pastikan privacy mode sudah dimatikan (langkah 4)

### Port 3000 Sudah Dipakai

```bash
sudo lsof -i :3000
sudo kill -9 PID_PROSES
```

### MySQL Tidak Mau Start

```bash
docker compose logs mysql
```

Jika corrupt, reset database:
```bash
docker compose down
docker volume rm bukaolshop-digiflazz-qris_mysql_data
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

**HATI-HATI**: Ini menghapus semua data database!

### SSL Certificate Expired

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Cek Penggunaan Memori

```bash
free -h
docker stats --no-stream
```

Jika RAM kurang dari 1GB, kurangi buffer MySQL di `mysql-conf/my.cnf`:
```ini
innodb-buffer-pool-size = 64M
```

---

## Checklist Final

Setelah semua langkah selesai, verifikasi:

- [ ] `docker compose ps` → semua container `running (healthy)`
- [ ] `curl http://localhost:3000/health` → `"status": "ok"`, `"database": "connected"`
- [ ] Telegram bot merespon `/start` dan `/menu`
- [ ] Webhook BukaOlshop terkonfigurasi
- [ ] Webhook Digiflazz terkonfigurasi
- [ ] Webhook Payment terkonfigurasi
- [ ] Cron backup jalan (`crontab -l`)
- [ ] Firewall aktif (`sudo ufw status`)
- [ ] Auto-restart bekerja (reboot VPS, cek container hidup lagi)

### Test Reboot

```bash
sudo reboot
```

Setelah VPS hidup lagi (tunggu 1-2 menit):
```bash
ssh deploy@IP_VPS_ANDA
docker compose ps
curl http://localhost:3000/health
```

Semua harus berjalan normal tanpa intervensi manual.
