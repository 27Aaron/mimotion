#!/bin/sh
set -eu

database_path="${DATABASE_URL:-/app/data/mimotion.db}"
database_dir="$(dirname "$database_path")"

mkdir -p "$database_dir"

if [ "$(id -u)" = "0" ]; then
  chown -R appuser:nodejs "$database_dir"
  exec gosu appuser "$@"
fi

exec "$@"
