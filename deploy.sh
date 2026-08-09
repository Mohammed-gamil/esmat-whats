#!/usr/bin/env bash
# ==============================================================================
# 🚀 WhatsApp AI Sales Agent & OpenWA Gateway — Server Deployment Script
# ==============================================================================
# Prevents server OOM crashes, cleans stale Docker cache, allocates swap space,
# and executes a sequential, low-memory production build & restart.
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN} 🚀 WhatsApp AI Sales Agent — Safe Server Deployment${NC}"
echo -e "${CYAN}======================================================================${NC}"

# ------------------------------------------------------------------------------
# Step 1: Ensure 4 GB Swap Space to prevent OOM Crashes
# ------------------------------------------------------------------------------
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -lt 2000 ]; then
  echo -e "${YELLOW}⚠️  Low/Missing Swap space detected (${SWAP_TOTAL}MB). Allocating 4GB swap space to prevent build crashes...${NC}"
  sudo swapoff -a || true
  sudo rm -f /swapfile || true
  sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo -e "${GREEN}✓ 4GB Swap space enabled!${NC}"
else
  echo -e "${GREEN}✓ Swap space active (${SWAP_TOTAL}MB)${NC}"
fi

# ------------------------------------------------------------------------------
# Step 2: Clean Stale Images & System Logs (Preserves Build Cache)
# ------------------------------------------------------------------------------
echo -e "${CYAN}▸ Cleaning unused dangling images and system logs...${NC}"
docker image prune -f || true
sudo apt-get clean || true
sudo journalctl --vacuum-time=1d || true
echo -e "${GREEN}✓ Cleaned system logs & dangling images (Build cache preserved)!${NC}"

# ------------------------------------------------------------------------------
# Step 3: Git Pull Latest Code
# ------------------------------------------------------------------------------
echo -e "${CYAN}▸ Pulling latest code from GitHub (main)...${NC}"
git pull origin main

# ------------------------------------------------------------------------------
# Step 4: Ensure .env exists
# ------------------------------------------------------------------------------
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  .env file not found. Copying .env.example -> .env...${NC}"
  cp .env.example .env
fi

# ------------------------------------------------------------------------------
# Step 5: Sequential Low-Memory Build
# ------------------------------------------------------------------------------
echo -e "${CYAN}▸ Executing sequential container builds (prevents memory spikes)...${NC}"

# Set Node build memory limit to 1.5 GB per build process & enable live progress logging
export NODE_OPTIONS="--max-old-space-size=1536"
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

echo -e "${CYAN}  1/4 Building PostgreSQL & Redis services...${NC}"
docker compose build postgres redis

echo -e "${CYAN}  2/4 Building OpenWA Gateway container...${NC}"
docker compose build gateway

echo -e "${CYAN}  3/4 Building Next.js Application container...${NC}"
docker compose build app

# ------------------------------------------------------------------------------
# Step 6: Start All Services
# ------------------------------------------------------------------------------
echo -e "${CYAN}▸ Starting production microservices...${NC}"
docker compose up -d

echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN} 🎉 Deployment Complete & Microservices Online!${NC}"
echo -e "${GREEN}======================================================================${NC}"
docker compose ps
