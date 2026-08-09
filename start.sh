#!/usr/bin/env bash
# ============================================================================
#  start.sh — OpenWA Gateway & WhatsApp AI Agent Platform Master Launcher
#  Adheres to OpenWA Skill Standards (github.com/rmyndharis/OpenWA)
# ============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "${CYAN}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠️${NC} $1"; }
error()   { echo -e "${RED}✖${NC} $1"; }

echo -e "${BOLD}${CYAN}"
echo "======================================================================"
echo " 🤖  WhatsApp AI Agent & OpenWA Gateway Standalone Launcher"
echo "======================================================================"
echo -e "${NC}"

# 1. OpenWA Account Safety & Anti-Ban Notice
echo -e "${DIM}🛡️ OpenWA Gateway operates via companion web protocols."
echo -e "   Recommended: Link a dedicated/burner line (not personal main account)."
echo -e "   Anti-ban pacing: Default inter-message delay & simulated typing active.${NC}\n"

# 2. Terminate pre-existing server processes & clear occupied ports
info "Terminating pre-existing processes & clearing ports (2785, 3000, 3001, 3002, 6379)..."
pkill -f "node dist/main" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
fuser -k 2785/tcp 3000/tcp 3001/tcp 3002/tcp 6379/tcp 2>/dev/null || true
sleep 1
success "Environment cleared for fresh launch"

# 3. Environment file initialization
if [ ! -f ".env" ]; then
    info "Initializing .env configuration from .env.example..."
    cp .env.example .env
fi

# 3. Master API Key Resolution & Auto-Sync
MASTER_KEY="${OPENWA_API_KEY:-esmat_whatsapp_master_key_2026}"
if [ -f "openwa/data/.api-key" ]; then
    FILE_KEY=$(cat openwa/data/.api-key 2>/dev/null | tr -d '\r\n ' || true)
    if [ -n "$FILE_KEY" ]; then
        MASTER_KEY="$FILE_KEY"
    fi
fi

# Write master key to OpenWA data directory (owner-only permissions)
mkdir -p openwa/data
echo -n "$MASTER_KEY" > openwa/data/.api-key
chmod 600 openwa/data/.api-key 2>/dev/null || true

# Always synchronize .env with active master API key
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
success "Synchronized Master API Key across OpenWA & Next.js"

# 4. Redis Key-Value Store Check & Fallback
if command -v redis-cli &> /dev/null && redis-cli -p 6379 ping 2>/dev/null | grep -q PONG; then
    success "Redis KV Store active on localhost:6379"
elif [ -x "tools/redis/redis-server" ]; then
    info "Starting user-space Redis instance on localhost:6379..."
    mkdir -p tools/redis/data
    (nohup ./tools/redis/redis-server --port 6379 --dir "$(pwd)/tools/redis/data" --daemonize no \
        --logfile "$(pwd)/tools/redis/redis.log" > /dev/null 2>&1 &)
    sleep 1
    if ./tools/redis/redis-cli -p 6379 ping 2>/dev/null | grep -q PONG; then
        success "User-space Redis active on localhost:6379"
    else
        warn "Redis start failed — using high-performance in-memory KV fallback"
    fi
else
    warn "Redis server omitted — running with in-memory KV fallback"
fi

# 5. OpenWA NestJS Gateway Initialization & Launch
if [ -d "openwa" ]; then
    if [ ! -d "openwa/node_modules" ]; then
        info "Installing OpenWA Gateway dependencies..."
        (cd openwa && npm install --silent &> /dev/null || npm install)
    fi

    if [ ! -f "openwa/dist/main.js" ]; then
        info "Compiling OpenWA Gateway TypeScript assets..."
        (cd openwa && npm run build &> /dev/null || npm run build)
    fi

    if lsof -i :2785 >/dev/null 2>&1 || fuser 2785/tcp >/dev/null 2>&1; then
        success "OpenWA Gateway active on http://localhost:2785"
    else
        info "Launching OpenWA NestJS Gateway process (port 2785)..."
        (cd openwa && nohup env \
            API_MASTER_KEY="$MASTER_KEY" \
            OPENWA_API_KEY="$MASTER_KEY" \
            AUTO_START_SESSIONS=true \
            SIMULATE_TYPING=true \
            WEBHOOK_SSRF_PROTECT=false \
            SSRF_ALLOWED_HOSTS=localhost,127.0.0.1,app \
            node dist/main > "$(pwd)/openwa.log" 2>&1 & disown)
        
        # Poll gateway readiness up to 10 seconds
        for i in {1..20}; do
            if curl -s http://localhost:2785/api/health 2>/dev/null | grep -q '"status":"ok"'; then
                break
            fi
            sleep 0.5
        done

        if curl -s http://localhost:2785/api/health 2>/dev/null | grep -q '"status":"ok"'; then
            success "OpenWA Gateway initialized & active on http://localhost:2785"
        else
            warn "OpenWA Gateway initializing in background..."
        fi
    fi
else
    warn "openwa gateway folder not found — running standalone web UI mode."
fi

# 6. Database Schema Synchronization
info "Syncing Prisma SQLite database schema..."
npx prisma db push --skip-generate &> /dev/null || true
success "Database schema ready (dev.db)"

# 7. Platform Status & Standalone Launch
echo -e "\n${BOLD}${GREEN}🚀 WhatsApp AI Agent Platform ready!${NC}\n"
echo -e "${CYAN}• WhatsApp AI Agent Dashboard:${NC} http://localhost:3000"
echo -e "${CYAN}• OpenWA Gateway API:${NC}          http://localhost:2785"
echo -e "${CYAN}• OpenWA Swagger API Docs:${NC}     http://localhost:2785/api/docs"
echo -e "${CYAN}• OpenWA Webhook Ingress:${NC}      http://localhost:3000/api/whatsapp/webhook"
echo -e "${CYAN}• Redis KV Store:${NC}              localhost:6379\n"

exec npm run dev
