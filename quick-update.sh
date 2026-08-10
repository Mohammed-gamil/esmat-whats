#!/usr/bin/env bash
# ==============================================================================
# ⚡ WhatsApp AI Sales Agent — Fast App Update
# ==============================================================================
# Rebuilds ONLY the Next.js app container without touching Postgres, Redis,
# or the OpenWA Gateway container.
#
# Usage:
#   ./quick-update.sh           # normal update (uses Docker layer cache)
#   ./quick-update.sh --clean   # force full rebuild (clears all cached layers)
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

CLEAN_BUILD=false
for arg in "$@"; do
  [[ "$arg" == "--clean" ]] && CLEAN_BUILD=true
done

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN} ⚡ WhatsApp AI Sales Agent — Quick App Update${NC}"
echo -e "${CYAN}======================================================================${NC}"

echo -e "${CYAN}▸ Pulling latest code from GitHub...${NC}"
git pull origin main

export NODE_OPTIONS="--max-old-space-size=1536"
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

if [ "$CLEAN_BUILD" = true ]; then
  echo -e "${YELLOW}▸ Clean build requested — removing old app image & build cache...${NC}"
  docker compose stop app
  docker compose rm -f app
  docker rmi "$(docker compose images -q app)" 2>/dev/null || true
  docker builder prune -f --filter type=exec.cachemount 2>/dev/null || true
  echo -e "${CYAN}▸ Rebuilding Next.js Web App (NO cache — full clean build)...${NC}"
  docker compose build --no-cache app
else
  echo -e "${CYAN}▸ Rebuilding Next.js Web App (with layer cache)...${NC}"
  docker compose build app
fi

echo -e "${CYAN}▸ Restarting App service...${NC}"
docker compose up -d --no-deps app

echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🚀 Quick Update Complete! (Postgres, Redis & Gateway were untouched)${NC}"
echo -e "${GREEN}======================================================================${NC}"
