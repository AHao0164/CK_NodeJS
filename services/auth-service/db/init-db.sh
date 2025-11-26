#!/bin/bash
# ============================================
# Auth Service - Standalone Database Setup
# ============================================
# This script allows auth-service to run independently
# Usage: ./init-db.sh

MYSQL_HOST=${MYSQL_HOST:-localhost}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-rootpw}

echo "🔧 Initializing Auth Service Database..."
echo "Host: $MYSQL_HOST:$MYSQL_PORT"

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL..."
until mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" &> /dev/null
do
  echo "MySQL not ready, waiting..."
  sleep 2
done

echo "✅ MySQL is ready!"

# Run schema
echo "📦 Creating auth_db schema..."
mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --default-character-set=utf8mb4 < db/schema.sql

if [ $? -eq 0 ]; then
  echo "✅ Auth Service database initialized successfully!"
else
  echo "❌ Failed to initialize database"
  exit 1
fi
