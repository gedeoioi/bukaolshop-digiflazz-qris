# Deploy bukaolshop-digiflazz-qris ke VPS

Panduan lengkap dari nol sampai production.

---

## Daftar Isi

1. [Persiapan VPS](#1-persiapan-vps)
2. [Install Docker & Docker Compose](#2-install-docker--docker-compose)
3. [Setup Domain & DNS](#3-setup-domain--dns)
4. [Clone Project ke VPS](#4-clone-project-ke-vps)
5. [Konfigurasi Environment](#5-konfigurasi-environment)
6. [Build & Jalankan Aplikasi](#6-build--jalankan-aplikasi)
7. [Setup Nginx Reverse Proxy + SSL](#7-setup-nginx-reverse-proxy--ssl)
8. [Setup Firewall](#8-setup-firewall)
9. [Setup Auto Backup Database](#9-setup-auto-backup-database)
10. [Setup Auto Restart & Monitoring](#10-setup-auto-restart--monitoring)
11. [Konfigurasi Webhook External](#11-konfigurasi-webhook-external)
12. [Perintah Operasional Sehari-hari](#12-perintah-operasional-sehari-hari)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Persiapan VPS

### Spesifikasi Minimum

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 1 GB | 2 GB |
| CPU | 1 Core | 2 Core |
| Storage | 20 GB SSD | 40 GB SSD |

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

Output yang diharapkan:
```
Docker version 24.x.x atau lebih baru
Docker Compose version v2.x.x
```

### Start Docker otomatis saat boot

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 3. Setup Domain & DNS

### Beli Domain

Beli domain dari registrar manapun (Namecheap, Cloudflare, Niagahoster, dll).

### Konfigurasi DNS

Tambah DNS record di panel domain Anda:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `IP_VPS_ANDA` | 300 |
| A | `api` | `IP_VPS_ANDA` | 300 |

Contoh: jika domain Anda `domainanda.com`, maka:
- `domainanda.com` → IP VPS
- `api.domainanda.com` → IP VPS (untuk webhook)

### Verifikasi DNS

Tunggu 5-15 menit, lalu cek:
```bash
dig api.domainanda.com +short
# Harus output: IP_VPS_ANDA
```

---

## 4. Clone Project ke VPS

### Install Git (sudah diinstall di langkah 1)

```bash
git --version
```

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

## 5. Konfigurasi Environment

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
# TELEGRAM
# ============================================
TELEGRAM_BOT_TOKEN=isi_dari_botfather
TELEGRAM_ADMIN_IDS=telegram_id_anda,telegram_id_admin_lain

# ============================================
# SECURITY
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### Tips Password MySQL

Generate password kuat:
```bash
openssl rand -base64 32
```

**PENTING**: 
- `DATABASE_URL` di dalam container, hostname MySQL adalah `mysql` (nama service di docker-compose), BUKAN `localhost`.
- `MYSQL_ROOT_PASSWORD` harus sama dengan password di `DATABASE_URL`.
- `PAYMENT_CALLBACK_URL` harus menggunakan domain production Anda.

### Simpan dan Keluar

Tekan `Ctrl+X`, lalu `Y`, lalu `Enter`.

---

## 6. Build & Jalankan Aplikasi

### Build Docker Image dan Jalankan

```bash
docker compose up -d --build
```

Proses ini akan:
1. Build image Node.js (multi-stage build)
2. Pull image MySQL 8.0
3. Jalankan MySQL container
4. Jalankan App container (setelah MySQL sehat)
5. Prisma migrate otomatis saat container start

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

### Jalankan Database Migration

Container app seharusnya sudah otomatis menjalankan Prisma generate saat build. Tapi jika perlu migrate manual:

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

---

## 7. Setup Nginx Reverse Proxy + SSL

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

Isi dengan:

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

### Aktifkan Config

```bash
sudo ln -s /etc/nginx/sites-available/bukaolshop /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Install SSL Certificate

```bash
sudo certbot --nginx -d api.domainanda.com
```

Ikuti prompt:
1. Masukkan email
2. Setuju ToS (Y)
3. Pilih redirect HTTP ke HTTPS (2)

### Verifikasi Auto-Renewal SSL

```bash
sudo certbot renew --dry-run
```

### Cek Nginx Config Final

```bash
sudo cat /etc/nginx/sites-available/bukaolshop
```

Setelah certbot, config akan otomatis berubah menjadi:

```nginx
server {
    listen 80;
    server_name api.domainanda.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.domainanda.com;

    ssl_certificate /etc/letsencrypt/live/api.domainanda.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.domainanda.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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
    }
}
```

### Verifikasi SSL

```bash
curl -I https://api.domainanda.com/health
```

---

## 8. Setup Firewall

### Konfigurasi UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Verifikasi

```bash
sudo ufw status verbose
```

Output:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80,443/tcp (Nginx Full)    ALLOW       Anywhere
```

**PENTING**: Jangan buka port 3306 (MySQL) ke public! Akses database hanya dari dalam server.

### Blokir Akses Langsung ke Port 3000

Karena sudah ada Nginx, blokir akses langsung ke port 3000 dari luar:

```bash
sudo ufw deny 3000
```

---

## 9. Setup Auto Backup Database

### Edit Script Backup

```bash
nano scripts/backup.sh
```

Pastikan isi script sudah benar (sudah ada di project). Script ini akan:
- Dump database MySQL
- Compress ke .sql.gz
- Simpan di `/var/backups/bukaolshop`
- Hapus backup lebih dari 7 hari

### Buat Direktori Backup

```bash
sudo mkdir -p /var/backups/bukaolshop
sudo chown $USER:$USER /var/backups/bukaolshop
```

### Set Permission Script

```bash
chmod +x scripts/backup.sh
```

### Edit Script untuk Pakai Docker

Karena MySQL berjalan di Docker, kita perlu modifikasi script backup. Buat script baru:

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

### Verifikasi Cron

```bash
crontab -l
```

---

## 10. Setup Auto Restart & Monitoring

### Docker Restart Policy

Sudah diatur di `docker-compose.yml` dengan `restart: unless-stopped`. Container akan otomatis restart jika crash atau VPS reboot.

### Verifikasi

```bash
# Simulasi: stop container, pastikan auto-restart
docker compose stop app
sleep 5
docker compose ps
# Container app harusnya restarting/running
docker compose start app
```

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

Buat script monitoring:

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
    
    # Kirim notifikasi ke Telegram
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$message" > /dev/null
    
    # Restart container
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

## 11. Konfigurasi Webhook External

### BukaOlshop Webhook

Di dashboard BukaOlshop, set webhook URL ke:
```
https://api.domainanda.com/api/webhook/bukaolshop
```

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

### Telegram Bot Webhook

Set webhook Telegram bot:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://api.domainanda.com/api/webhook/telegram"
```

Atau jika bot menggunakan polling (default Telegraf), tidak perlu set webhook.

---

## 12. Perintah Operasional Sehari-hari

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

### Cek Disk Usage Docker

```bash
docker system df
```

### Cleanup Docker (Jika Disk Penuh)

```bash
docker system prune -af --volumes
```

**HATI-HATI**: Perintah ini menghapus SEMUA container, image, dan volume yang tidak terpakai. Volume MySQL akan ikut terhapus! Backup dulu sebelum menjalankan.

Lebih aman:
```bash
# Hapus hanya image lama
docker image prune -a

# Hapus hanya container stopped
docker container prune
```

---

## 13. Troubleshooting

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
# Cek MySQL sehat
docker compose exec mysql mysqladmin ping -u root -p

# Cek DATABASE_URL benar
docker compose exec app printenv DATABASE_URL
```

### Port 3000 Sudah Dipakai

```bash
sudo lsof -i :3000
# Kill proses yang memakai port
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

Lalu restart:
```bash
docker compose restart mysql
```

---

## Checklist Final

Setelah semua langkah selesai, verifikasi:

- [ ] `docker compose ps` → semua container `running (healthy)`
- [ ] `curl http://localhost:3000/health` → `"status": "ok"`, `"database": "connected"`
- [ ] `curl https://api.domainanda.com/health` → response 200 via HTTPS
- [ ] Webhook BukaOlshop terkonfigurasi
- [ ] Webhook Digiflazz terkonfigurasi
- [ ] Webhook Payment terkonfigurasi
- [ ] Telegram bot merespon
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
