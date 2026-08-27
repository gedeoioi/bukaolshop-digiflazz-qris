# Deploy ke VPS Tanpa Domain — Telegram Bot Langsung Aktif

Panduan step-by-step dari nol sampai bot Telegram bisa dipakai transaksi.

---

## Daftar Isi

1. [Persiapan VPS](#1-persiapan-vps)
2. [Install Docker](#2-install-docker)
3. [Buat Telegram Bot](#3-buat-telegram-bot)
4. [Daftar Digiflazz](#4-daftar-digiflazz)
5. [Clone & Konfigurasi](#5-clone--konfigurasi)
6. [Build & Jalankan](#6-build--jalankan)
7. [Verifikasi & Test](#7-verifikasi--test)
8. [Setup Firewall](#8-setup-firewall)
9. [Set Webhook External](#9-set-webhook-external)
10. [Auto Backup Database](#10-auto-backup-database)
11. [Perintah Harian](#11-perintah-harian)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Persiapan VPS

### Spesifikasi Minimum

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 1 GB | 2 GB |
| CPU | 1 Core | 2 Core |
| Storage | 20 GB SSD | 40 GB SSD |

Rekomendasi: DigitalOcean, Vultr, Hetzner, Linode, AWS Lightsail.

### Akses & Update

```bash
ssh root@IP_VPS_ANDA
apt update && apt upgrade -y
apt install -y curl wget git ufw
```

---

## 2. Install Docker

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker
```

Verifikasi:

```bash
docker --version
docker compose version
```

---

## 3. Buat Telegram Bot

### 3.1 Buat Bot

1. Buka Telegram, cari **@BotFather** (centang biru)
2. Kirim: `/newbot`
3. Isi nama: `BukaOlshop Bot`
4. Isi username: `bukaolshop_xxx_bot` (harus akhiri dengan `bot`)
5. Simpan **TOKEN** yang diberikan:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

### 3.2 Dapatkan User ID Anda

1. Cari **@userinfobot** di Telegram
2. Kirim pesan apapun
3. Catat angka `Id:` — ini Telegram User ID Anda
   ```
   Id: 123456789
   ```

### 3.3 Matikan Privacy Mode

1. Chat **@BotFather** → `/mybots`
2. Pilih bot Anda → **Bot Settings** → **Group Privacy**
3. Pilih **Turn off**

---

## 4. Daftar Digiflazz

### 4.1 Buat Akun

1. Buka https://digiflazz.com
2. Daftar dan verifikasi email/HP
3. Login ke dashboard

### 4.2 Ambil Credentials

1. Buka **Pengaturan** → **API**
2. Catat:
   - **Username** (contoh: `tokosaya`)
   - **API Key** (contoh: `a1b2c3d4e5f6...`)

### 4.3 Top Up Deposit

1. Buka menu **Deposit**
2. Pilih metode (Transfer/VA/QRIS)
3. Transfer minimal Rp 10.000
4. Tunggu konfirmasi

---

## 5. Clone & Konfigurasi

### 5.1 Clone Repository

```bash
cd /root
git clone https://github.com/USERNAME_ANDA/bukaolshop-digiflazz-qris.git
cd bukaolshop-digiflazz-qris
```

Jika repo private:
```bash
git clone https://USERNAME:TOKEN@github.com/USERNAME_ANDA/bukaolshop-digiflazz-qris.git
```

### 5.2 Buat .env

```bash
cp .env.example .env
nano .env
```

### 5.3 Isi .env

```env
# ============================================
# APPLICATION
# ============================================
NODE_ENV=production
PORT=3000
API_PREFIX=/api

# ============================================
# MYSQL (ganti password!)
# ============================================
MYSQL_ROOT_PASSWORD=GANTI_password_kuat_1
MYSQL_DATABASE=bukaolshop_db
MYSQL_USER=appuser
MYSQL_PASSWORD=GANTI_password_kuat_2

# ============================================
# DATABASE (hostname=mysql, sesuai docker-compose)
# ============================================
DATABASE_URL="mysql://root:GANTI_password_kuat_1@mysql:3306/bukaolshop_db"

# ============================================
# BUKAOLSHOP
# ============================================
BUKAOLSHOP_API_URL=https://api.bukaolshop.com/v1
BUKAOLSHOP_API_KEY=isi_dari_dashboard_bukaolshop
BUKAOLSHOP_WEBHOOK_SECRET=isi_dari_dashboard_bukaolshop

# ============================================
# DIGIFLAZZ (dari langkah 4)
# ============================================
DIGIFLAZZ_USERNAME=tokosaya
DIGIFLAZZ_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
DIGIFLAZZ_BASE_URL=https://api.digiflazz.com
DIGIFLAZZ_WEBHOOK_SECRET=

# ============================================
# PAYMENT (QRIS)
# ============================================
PAYMENT_PROVIDER=isi_nama_provider
PAYMENT_API_URL=isi_url_api_payment
PAYMENT_API_KEY=isi_apikey_payment
PAYMENT_MERCHANT_ID=isi_merchant_id
PAYMENT_WEBHOOK_SECRET=isi_webhook_secret
PAYMENT_CALLBACK_URL=http://IP_VPS_ANDA:3000/api/webhook/payment

# ============================================
# TELEGRAM (dari langkah 3)
# ============================================
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_IDS=123456789

# ============================================
# SECURITY
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**PENTING:**
- `DATABASE_URL` hostname harus `mysql` (bukan `localhost`)
- `MYSQL_ROOT_PASSWORD` harus sama dengan password di `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN` dari BotFather
- `TELEGRAM_ADMIN_IDS` dari @userinfobot
- `PAYMENT_CALLBACK_URL` pakai `http://IP_VPS:3000`

Generate password kuat:
```bash
openssl rand -base64 32
```

Simpan: `Ctrl+X` → `Y` → `Enter`

---

## 6. Build & Jalankan

```bash
docker compose up -d --build
```

Tunggu sampai selesai (2-5 menit tergantung spesifikasi VPS).

Cek status:
```bash
docker compose ps
```

Harus muncul:
```
NAME                STATUS                  PORTS
bukaolshop-mysql    running (healthy)       0.0.0.0:3306->3306/tcp
bukaolshop-app      running (healthy)       0.0.0.0:3000->3000/tcp
```

Jika container app belum healthy, tunggu 30 detik (MySQL masih inisialisasi).

Cek log jika ada error:
```bash
docker compose logs app
```

---

## 7. Verifikasi & Test

### 7.1 Health Check

```bash
curl http://localhost:3000/health
```

Harus muncul:
```json
{
  "status": "ok",
  "database": "connected",
  "telegram": "configured",
  "digiflazz": "configured",
  "payment": "configured"
}
```

### 7.2 Test Telegram Bot

Buka Telegram:
1. Cari bot Anda (`@bukaolshop_xxx_bot`)
2. Kirim `/start` — bot membalas sambutan
3. Kirim `/menu` — muncul menu inline
4. Kirim `/saldo` — muncul saldo Digiflazz
5. Kirim `/sync` — sinkronisasi produk dari Digiflazz

### 7.3 Test dari Luar VPS

```bash
curl http://IP_VPS_ANDA:3000/health
```

Jika gagal, cek firewall (langkah 8).

---

## 8. Setup Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3000/tcp
ufw enable
```

Verifikasi:
```bash
ufw status
```

Output:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
3000/tcp                   ALLOW       Anywhere
```

**JANGAN** buka port 3306 (MySQL) ke public.

---

## 9. Set Webhook External

Setelah semua jalan, set webhook di masing-masing dashboard:

| Service | Webhook URL |
|---------|-------------|
| BukaOlshop | `http://IP_VPS_ANDA:3000/api/webhook/bukaolshop` |
| Digiflazz | `http://IP_VPS_ANDA:3000/api/webhook/digiflazz` |
| Payment | `http://IP_VPS_ANDA:3000/api/webhook/payment` |

**Telegram bot TIDAK perlu webhook** — bot pakai polling, langsung aktif begitu container jalan.

---

## 10. Auto Backup Database

### Buat Script

```bash
nano /root/bukaolshop-digiflazz-qris/scripts/backup-docker.sh
```

Isi:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/bukaolshop"
DATE=$(date +%Y-%m-%d_%H-%M)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ -f /root/bukaolshop-digiflazz-qris/.env ]; then
    source /root/bukaolshop-digiflazz-qris/.env
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

### Set Permission & Test

```bash
chmod +x /root/bukaolshop-digiflazz-qris/scripts/backup-docker.sh
mkdir -p /var/backups/bukaolshop
/root/bukaolshop-digiflazz-qris/scripts/backup-docker.sh
ls -la /var/backups/bukaolshop/
```

### Setup Cron

```bash
crontab -e
```

Tambahkan:
```
0 2 * * * /root/bukaolshop-digiflazz-qris/scripts/backup-docker.sh >> /var/log/bukaolshop-backup.log 2>&1
```

---

## 11. Perintah Harian

```bash
# Cek status container
docker compose ps

# Log real-time
docker compose logs -f app

# Restart app saja
docker compose restart app

# Restart semua (termasuk MySQL)
docker compose restart

# Stop semua
docker compose down

# Update dari git & rebuild
git pull origin main
docker compose up -d --build

# Masuk ke container (debug)
docker compose exec app sh

# Masuk ke MySQL CLI
docker compose exec mysql mysql -u root -p bukaolshop_db

# Cek resource
docker stats

# Cleanup image lama
docker image prune -a
```

---

## 12. Troubleshooting

### Container terus restart

```bash
docker compose logs app
```

Kemungkinan:
- `.env` salah (cek `DATABASE_URL`, `MYSQL_ROOT_PASSWORD`)
- MySQL belum siap (tunggu 30 detik)
- Port 3000 dipakai proses lain

### Database connection error

```bash
docker compose exec mysql mysqladmin ping -u root -p
docker compose exec app printenv DATABASE_URL
```

### Telegram bot tidak merespon

```bash
docker compose logs app | grep -i telegram
```

Cek:
- `TELEGRAM_BOT_TOKEN` benar (cek di BotFather)
- `TELEGRAM_ADMIN_IDS` berisi User ID (bukan username)
- Kirim `/start` ke bot
- Privacy mode sudah dimatikan

### Port 3000 dipakai

```bash
lsof -i :3000
kill -9 PID_PROSES
```

### MySQL corrupt

```bash
docker compose down
docker volume rm bukaolshop-digiflazz-qris_mysql_data
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

**HATI-HATI:** Ini hapus semua data database!

### RAM kurang dari 1GB

Edit `mysql-conf/my.cnf`:
```ini
innodb-buffer-pool-size = 64M
```

Restart:
```bash
docker compose restart mysql
```

---

## Checklist Final

- [ ] `docker compose ps` → semua `running (healthy)`
- [ ] `curl http://localhost:3000/health` → `"status": "ok"`
- [ ] Telegram bot `/start` merespon
- [ ] Telegram bot `/saldo` menampilkan saldo
- [ ] Webhook BukaOlshop diset
- [ ] Webhook Digiflazz diset
- [ ] Webhook Payment diset
- [ ] Cron backup aktif (`crontab -l`)
- [ ] Firewall aktif (`ufw status`)
- [ ] Reboot VPS → semua auto-start (`reboot`, lalu cek `docker compose ps`)
