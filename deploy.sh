#!/bin/bash
set -e

echo "=================================================="
echo " [TpayX aaPanel Auto-Deployment Script]"
echo "=================================================="

PROJECT_DIR="/www/wwwroot/tpayx"

if [ -d "$PROJECT_DIR" ]; then
  cd "$PROJECT_DIR"
else
  echo "[Deploy] Using current working directory..."
fi

# 1. Pull latest code from GitHub
echo "\n>>> 1/5 Pulling latest code from GitHub..."
git pull origin main

# 2. Update Backend
echo "\n>>> 2/5 Installing Backend dependencies..."
cd backend
npm install --production

# 3. Build Frontend
echo "\n>>> 3/5 Building Frontend (Web Landing & App)..."
cd ../frontend
npm install
npm run build

# 4. Build Admin Panel
echo "\n>>> 4/5 Building Admin Panel..."
cd ../admin-panel
npm install
npm run build

# 5. Reload Backend on PM2
echo "\n>>> 5/5 Reloading Backend Process in PM2..."
cd ../backend
pm2 reload tpayx-backend || pm2 start src/server.js --name tpayx-backend

echo "\n=================================================="
echo " [SUCCESS] TpayX is 100% Updated and Live!"
echo "=================================================="
