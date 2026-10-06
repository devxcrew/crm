#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
CONFIG_ENV="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

if [[ ! -f "$CONFIG_ENV" ]]; then
  cp "$SCRIPT_DIR/.env.example" "$CONFIG_ENV"
  printf 'Created %s. Set its secrets, then run setup again.\n' "$CONFIG_ENV"
  exit 1
fi

compose() {
  docker compose --env-file "$CONFIG_ENV" -f "$COMPOSE_FILE" "$@"
}

cd "$ROOT_DIR"
compose config --quiet
compose up --build --detach
compose ps
