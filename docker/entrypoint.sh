#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/var/lib/mimotion}"

if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DATA_DIR"
    chown -R 10001:10001 "$DATA_DIR"
    exec su-exec 10001:10001 /usr/local/bin/mimotion
fi

exec /usr/local/bin/mimotion
