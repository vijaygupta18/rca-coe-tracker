.PHONY: dev dev-split build-frontend install db-up db-down clean migrate test

DEV_FAKE_EMAIL ?= you@example.com
DEV_FAKE_NAME  ?= Local Dev
DATABASE_URL   ?= postgresql+asyncpg://rca:rca@localhost:5432/rca_coe
ADMIN_EMAILS   ?= you@example.com
DB_SCHEMA      ?= rca_coe
PG_HOST        ?= localhost
PG_PORT        ?= 5432
PG_USER        ?= rca
PG_PASSWORD    ?= rca
PG_DB          ?= rca_coe

# One-process local: build the SPA into backend/static, run uvicorn alone.
# Same shape as production. Use this when you want a single service.
# Visit http://localhost:8000.
dev: build-frontend
	cd backend && \
	  DEV_FAKE_EMAIL='$(DEV_FAKE_EMAIL)' \
	  DEV_FAKE_NAME='$(DEV_FAKE_NAME)' \
	  DATABASE_URL='$(DATABASE_URL)' \
	  ADMIN_EMAILS='$(ADMIN_EMAILS)' \
	  DB_SCHEMA='$(DB_SCHEMA)' \
	  .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

# Two-process local with Vite HMR. Use this for fast frontend iteration.
# Vite on :5173 proxies /api -> :8000.
dev-split:
	@echo "Run these in two shells:"
	@echo "  cd backend && .venv/bin/uvicorn app.main:app --reload"
	@echo "  cd frontend && npm run dev"

build-frontend:
	cd frontend && npm run build
	rm -rf backend/static
	mkdir -p backend/static
	cp -R frontend/dist/. backend/static/

install:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
	cd frontend && npm install

db-up:
	docker compose up -d db

db-down:
	docker compose down

# Apply every migration in backend/migrations in lexicographic order.
# Idempotent: each migration uses CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
migrate:
	@for f in $$(ls backend/migrations/*.sql | sort); do \
	  echo "Applying $$f"; \
	  PGPASSWORD='$(PG_PASSWORD)' psql -h '$(PG_HOST)' -p '$(PG_PORT)' -U '$(PG_USER)' -d '$(PG_DB)' -v ON_ERROR_STOP=1 -f $$f || exit 1; \
	done

test:
	cd backend && .venv/bin/pytest tests/ -v

clean:
	rm -rf frontend/dist backend/static backend/.venv
