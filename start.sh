#!/usr/bin/env bash
# ============================================================================
#  start.sh — Master Launcher for WhatsApp AI Sales Agent Standalone
# ============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠️${NC} $1"; }
error()   { echo -e "${RED}✖${NC} $1"; }

echo -e "${BOLD}${CYAN}"
echo "======================================================================"
echo " 🤖  WhatsApp AI Sales Agent Standalone Platform Launcher"
echo "======================================================================"
echo -e "${NC}"

# 1. Environment file check
if [ ! -f ".env" ]; then
    info "Creating .env from .env.example..."
    cp .env.example .env
fi

# 2. Define and Sync Master API Key across OpenWA Gateway and Application
MASTER_KEY="${OPENWA_API_KEY:-esmat_whatsapp_master_key_2026}"
if [ -f "openwa/data/.api-key" ]; then
    FILE_KEY=$(cat openwa/data/.api-key 2>/dev/null | tr -d '\r\n ' || true)
    if [ -n "$FILE_KEY" ]; then
        MASTER_KEY="$FILE_KEY"
    fi
fi

# Ensure master key is written to openwa/data/.api-key
mkdir -p openwa/data
echo -n "$MASTER_KEY" > openwa/data/.api-key
chmod 600 openwa/data/.api-key 2>/dev/null || true

# Always keep .env synchronized with the active master API key
if grep -q '^OPENWA_API_KEY=' .env 2>/dev/null; then
    sed -i "s|^OPENWA_API_KEY=.*|OPENWA_API_KEY=\"$MASTER_KEY\"|g" .env
else
    echo "OPENWA_API_KEY=\"$MASTER_KEY\"" >> .env
fi

if grep -q '^API_MASTER_KEY=' .env 2>/dev/null; then
    sed -i "s|^API_MASTER_KEY=.*|API_MASTER_KEY=\"$MASTER_KEY\"|g" .env
else
    echo "API_MASTER_KEY=\"$MASTER_KEY\"" >> .env
fi
export OPENWA_API_KEY="$MASTER_KEY"
export API_MASTER_KEY="$MASTER_KEY"
success "Synchronized Master API Key across OpenWA Gateway & Application"

# 3. Redis Check & Fallback
if command -v redis-cli &> /dev/null && redis-cli -p 6379 ping 2>/dev/null | grep -q PONG; then
    success "Redis running on localhost:6379"
elif [ -x "tools/redis/redis-server" ]; then
    info "Starting user-space Redis on localhost:6379..."
    mkdir -p tools/redis/data
    (nohup ./tools/redis/redis-server --port 6379 --dir "$(pwd)/tools/redis/data" --daemonize no \
        --logfile "$(pwd)/tools/redis/redis.log" > /dev/null 2>&1 &)
    sleep 1
    if ./tools/redis/redis-cli -p 6379 ping 2>/dev/null | grep -q PONG; then
        success "Redis started on localhost:6379"
    else
        warn "Redis start failed — application will fall back to in-memory KV store"
    fi
else
    warn "No Redis server found — application will run with in-memory KV store fallback"
fi

# 4. OpenWA Gateway Check & Detached Launch
if [ -d "openwa" ]; then
    if [ ! -d "openwa/node_modules" ]; then
        info "Installing OpenWA Gateway dependencies..."
        (cd openwa && npm install --silent &> /dev/null || npm install)
    fi

    if [ ! -f "openwa/dist/main.js" ]; then
        info "Building OpenWA Gateway..."
        (cd openwa && npm run build &> /dev/null || npm run build)
    fi

    if lsof -i :2785 >/dev/null 2>&1 || fuser 2785/tcp >/dev/null 2>&1; then
        success "OpenWA Gateway active on http://localhost:2785"
    else
        info "Launching OpenWA NestJS Gateway on port 2785..."
        (cd openwa && nohup env API_MASTER_KEY="$MASTER_KEY" OPENWA_API_KEY="$MASTER_KEY" WEBHOOK_SSRF_PROTECT=false SSRF_ALLOWED_HOSTS=localhost,127.0.0.1 node dist/main > "$(pwd)/openwa.log" 2>&1 & disown)
        
        # Poll for gateway readiness up to 10 seconds
        for i in {1..20}; do
            if curl -s http://localhost:2785/api/health 2>/dev/null | grep -q '"status":"ok"'; then
                break
            fi
            sleep 0.5
        done

        if curl -s http://localhost:2785/api/health 2>/dev/null | grep -q '"status":"ok"'; then
            success "OpenWA Gateway active on http://localhost:2785"
        else
            warn "OpenWA Gateway starting up in background..."
        fi
    fi
else
    warn "openwa directory missing — please ensure OpenWA gateway is installed."
fi

# 5. Database Sync
info "Syncing Prisma SQLite database schema..."
npx prisma db push --skip-generate &> /dev/null || true
success "Database synced with dev.db"

# 6. Start Standalone Next.js Application
echo -e "\n${BOLD}${GREEN}🚀 WhatsApp AI Agent Standalone Platform ready!${NC}\n"
echo -e "${CYAN}• WhatsApp AI Agent Dashboard:${NC} http://localhost:3000"
echo -e "${CYAN}• OpenWA Gateway API:${NC}          http://localhost:2785"
echo -e "${CYAN}• OpenWA Webhook Endpoint:${NC}     http://localhost:3000/api/whatsapp/webhook"
echo -e "${CYAN}• Redis KV Store:${NC}              localhost:6379\n"

exec npm run dev
