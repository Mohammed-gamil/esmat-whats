# 🚀 Production Server Deployment Plan: WhatsApp AI Sales Agent & OpenWA Gateway

This deployment guide details how to deploy the **WhatsApp AI Sales Agent Platform** and **OpenWA Gateway** on a production Linux server (Ubuntu 22.04 / 24.04 LTS VPS or Cloud instance on DigitalOcean, Hetzner, AWS EC2, or Vultr) using **Docker Compose**, **PostgreSQL**, **Redis**, and **Nginx with SSL**.

---

## 📋 1. Server Hardware & OS Prerequisites

| Resource | Minimum Requirement | Recommended Production |
| :--- | :--- | :--- |
| **OS** | Ubuntu 22.04 / 24.04 LTS (64-bit) | Ubuntu 24.04 LTS |
| **CPU** | 2 vCPU cores | 4 vCPU cores |
| **RAM** | 4 GB RAM | 8 GB RAM (for Chrome Puppeteer & PostgreSQL) |
| **Storage** | 25 GB SSD/NVMe | 50 GB SSD/NVMe |
| **Ports** | 80 (HTTP), 443 (HTTPS), 22 (SSH) | 80, 443, 22 |

---

## 🛠️ 2. Step-by-Step Server Setup

### Step 1: Install Docker & Docker Compose v2
Run the following commands on your remote server via SSH:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install prerequisite tools
sudo apt install -y curl git ufw ca-certificates gnupg lsb-release

# Add Docker official GPG key & repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine & Docker Compose CLI
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable & start Docker service
sudo systemctl enable --now docker
```

---

### Step 2: Clone the Repository

```bash
# Navigate to your deployment directory
cd /opt
sudo git clone https://github.com/Mohammed-gamil/esmat-whats.git whatsapp-agent
cd whatsapp-agent
```

---

### Step 3: Configure Production Environment (`.env`)

Create your production `.env` file from the updated template:

```bash
cp .env.example .env
nano .env
```

Set the following **production values**:

```env
# ── Server Environment ──────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ── Production PostgreSQL Database ─────────────────────────────────────────
DATABASE_URL="postgresql://postgres:YOUR_STRONG_POSTGRES_PASSWORD@postgres:5432/whatsapp_platform?schema=public"

# ── OpenWA Gateway PostgreSQL Settings ─────────────────────────────────────
DATABASE_TYPE="postgres"
DATABASE_HOST="postgres"
DATABASE_PORT=5432
DATABASE_NAME="whatsapp_platform"
DATABASE_USERNAME="postgres"
DATABASE_PASSWORD="YOUR_STRONG_POSTGRES_PASSWORD"
DATABASE_SYNCHRONIZE="false"

# ── OpenWA Gateway & Master Keys ──────────────────────────────────────────
OPENWA_URL="http://gateway:2785"
OPENWA_API_KEY="YOUR_GENERATED_MASTER_KEY_2026"
API_MASTER_KEY="YOUR_GENERATED_MASTER_KEY_2026"

# ── Public Webhook & Domain Configuration ────────────────────────────────
WHATSAPP_WEBHOOK_URL="https://whatsapp.yourdomain.com/api/whatsapp/webhook"

# ── Redis Server ─────────────────────────────────────────────────────────
REDIS_HOST="redis"
REDIS_PORT=6379

# ── LLM Provider API Keys ─────────────────────────────────────────────────
OPENAI_API_KEY="sk-proj-..."
GEMINI_API_KEY="..."
ANTHROPIC_API_KEY="..."
```

---

### Step 4: Firewalls & Network Security (UFW)

Protect your database and gateway ports so only HTTP/HTTPS are exposed to the public internet:

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

> [!IMPORTANT]
> Ports `5432` (PostgreSQL), `2785` (OpenWA Gateway), and `6379` (Redis) will remain strictly internal within the isolated Docker bridge network.

---

### Step 5: Launch Containers with Docker Compose

Build and launch all 4 production microservices (**App**, **OpenWA Gateway**, **PostgreSQL**, **Redis**):

```bash
sudo docker compose up -d --build
```

Verify service statuses and healthchecks:

```bash
sudo docker compose ps
```

**Expected Output**:
```
NAME                       IMAGE                STATUS                   PORTS
whatsapp_sales_postgres    postgres:16-alpine   Up (healthy)             5432/tcp
openwa_whatsapp_gateway    whatsapp-agent-gtw   Up (healthy)             2785/tcp
whatsapp_sales_app         whatsapp-agent-app   Up                       3000/tcp
whatsapp_sales_redis       redis:7-alpine       Up (healthy)             6379/tcp
```

---

## 🌐 3. Nginx Reverse Proxy & SSL Setup

Install Nginx and Certbot to obtain a free **Let's Encrypt SSL certificate**:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create an Nginx configuration file: `/etc/nginx/sites-available/whatsapp-agent`

```nginx
server {
    server_name whatsapp.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site & obtain SSL certificate:

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-agent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue free Let's Encrypt SSL certificate
sudo certbot --nginx -d whatsapp.yourdomain.com
```

---

## 📱 4. WhatsApp Session Pairing & Persistence

1. Open `https://whatsapp.yourdomain.com` in your browser.
2. Go to **Step 1: Link WhatsApp Session**.
3. Click **Scan QR Code** or enter your phone number to get an 8-digit **Pairing Code**.
4. Link your companion line in WhatsApp -> **Linked Devices**.
5. Once authenticated, your session credentials persist automatically in the persistent Docker volume (`./openwa/.wwebjs_auth`).

---

## 🔄 5. Maintenance, Monitoring & Backups

### View Live Container Logs
```bash
# Application logs
sudo docker compose logs -f app

# Gateway logs
sudo docker compose logs -f gateway

# All service logs
sudo docker compose logs -f
```

### PostgreSQL Database Backup
Run manual or automated daily database dumps:

```bash
sudo docker exec -t whatsapp_sales_postgres pg_dump -U postgres whatsapp_platform > /opt/backups/whatsapp_db_$(date +%F).sql
```

### Update Code & Redeploy
```bash
cd /opt/whatsapp-agent
sudo git pull origin main
sudo docker compose up -d --build
```
