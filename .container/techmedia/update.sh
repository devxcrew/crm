#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
CONFIG_ENV="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

[[ -f "$CONFIG_ENV" ]] || { printf 'Missing %s. Run setup.sh first.\n' "$CONFIG_ENV"; exit 1; }

compose() {
  docker compose --env-file "$CONFIG_ENV" -f "$COMPOSE_FILE" "$@"
}

cd "$ROOT_DIR"
compose config --quiet
compose build api web
compose run --rm --no-deps api npm run db:migrate
compose run --rm --no-deps api npm run db:seed
compose up --detach --no-deps api web
wait_for_healthy api
wait_for_healthy web
compose ps

wait_for_healthy() {
  local service="$1"
  local container_id
  local health

  for _ in $(seq 1 45); do
    container_id="$(compose ps --quiet "$service")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    if [[ "$health" == "healthy" ]]; then
      return 0
    fi
    sleep 2
  done

  printf '%s did not become healthy.\n' "$service" >&2
  compose ps >&2
  return 1
}
