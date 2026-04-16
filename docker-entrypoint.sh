#!/bin/sh
set -e

DATA_DIR=$(dirname "${DATABASE_URL:-./data/mimotion.db}")
mkdir -p "$DATA_DIR"
chown -R nextjs:nodejs "$DATA_DIR"

echo "Initializing database..."
gosu nextjs node scripts/init-db.js

echo "Starting MiMotion server..."
exec gosu nextjs node server.js
