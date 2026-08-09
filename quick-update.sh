#!/usr/bin/env bash
# ==============================================================================
# ⚡ WhatsApp AI Sales Agent — Fast 15-Second App Update
# ==============================================================================
# Rebuilds ONLY the Next.js app container without touching Postgres, Redis,
# or the OpenWA Gateway container.
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN} ⚡ WhatsApp AI Sales Agent — Quick App Update${NC}"
echo -e "${CYAN}======================================================================${NC}"

echo -e "${CYAN}▸ Pulling latest code from GitHub...${NC}"
git pull origin main

export NODE_OPTIONS="--max-old-space-size=1536"
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

echo -e "${CYAN}▸ Rebuilding ONLY the Next.js Web App (fast cached build)...${NC}"
docker compose build app

echo -e "${CYAN}▸ Restarting App service...${NC}"
docker compose up -d --no-deps app

echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🚀 Quick Update Complete! (Postgres, Redis & Gateway were untouched)${NC}"
echo -e "${GREEN}======================================================================${NC}"
