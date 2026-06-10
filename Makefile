.PHONY: db-up db-down db-logs db-psql db-reset db-status help

DB_URL ?= postgres://forge:forge@localhost:5432/forge

help:
	@echo "Targets:"
	@echo "  db-up      Start local Postgres + pgvector (docker compose)"
	@echo "  db-down    Stop and remove the postgres container (keeps data)"
	@echo "  db-reset   Stop and wipe all local Postgres data (destructive)"
	@echo "  db-logs    Tail postgres logs"
	@echo "  db-psql    Open psql against the local DB"
	@echo "  db-status  Show docker compose ps + pg_isready"

db-up:
	docker compose up -d postgres
	@echo "Waiting for postgres to become healthy..."
	@until docker compose ps postgres --format '{{.Health}}' | grep -q healthy; do sleep 1; done
	@echo "Ready: $(DB_URL)"

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

db-psql:
	docker compose exec -e PGPASSWORD=forge postgres psql -U forge -d forge

db-reset:
	docker compose down -v
	rm -rf .postgres-data
	@echo "Local Postgres data wiped. Run 'make db-up' to recreate."

db-status:
	docker compose ps postgres
	@docker compose exec -T postgres pg_isready -U forge -d forge || true
