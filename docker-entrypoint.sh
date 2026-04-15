#!/bin/sh
set -e

DATA_DIR=$(dirname "${DATABASE_URL:-./data/mimotion.db}")
mkdir -p "$DATA_DIR"
chown -R nextjs:nodejs "$DATA_DIR"

exec su-exec nextjs:nodejs node server.js
