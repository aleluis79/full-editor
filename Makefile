# ──────────────────────────────────────────────────────────────
# Full Editor — Makefile
# ──────────────────────────────────────────────────────────────

.PHONY: help setup frontend-install backend-install frontend-dev backend-dev dev
.PHONY: db-start db-stop
.PHONY: frontend-build backend-migrate frontend-test backend-test test
.PHONY: frontend-lint backend-lint lint frontend-clean backend-clean clean
.PHONY: keycloak-start keycloak-stop keycloak-recreate keycloak-logs

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Setup ────────────────────────────────────────────────────

setup: frontend-install backend-install ## Install all dependencies (frontend + backend)

frontend-install: ## Install frontend dependencies
	cd frontend && npm install

backend-install: ## Install backend dependencies (inside .venv)
	. backend/.venv/bin/activate && cd backend && pip install -r requirements.txt

# ── Development ──────────────────────────────────────────────

frontend-dev: ## Start frontend dev server (Vite)
	cd frontend && npm run dev

backend-dev: ## Start backend dev server (uvicorn with reload)
	. backend/.venv/bin/activate && cd backend && python main.py

dev: ## Start both frontend and backend dev servers
	@echo "Starting backend..."
	. backend/.venv/bin/activate && cd backend && python main.py &
	@sleep 1
	@echo "Starting frontend..."
	cd frontend && npm run dev

# ── Build ────────────────────────────────────────────────────

frontend-build: ## Build frontend for production
	cd frontend && npm run build

# ── Database ─────────────────────────────────────────────────

db-start: ## Start PostgreSQL container if not already running
	@if [ "$$(docker ps -q -f name=full-editor-db)" = "" ]; then \
		echo "Starting PostgreSQL container..."; \
		docker run -d \
			--name full-editor-db \
			-e POSTGRES_USER=user \
			-e POSTGRES_PASSWORD=pass \
			-e POSTGRES_DB=full_editor \
			-p 5432:5432 \
			postgres:16-alpine; \
		echo "Waiting for PostgreSQL to be ready..."; \
		until docker exec full-editor-db pg_isready -U user -d full_editor > /dev/null 2>&1; do \
			sleep 1; \
		done; \
		echo "PostgreSQL is ready!"; \
	else \
		echo "PostgreSQL container is already running."; \
	fi

db-stop: ## Stop and remove the PostgreSQL container
	docker stop full-editor-db 2>/dev/null || true
	docker rm full-editor-db 2>/dev/null || true

backend-migrate: ## Run Alembic migrations
	. backend/.venv/bin/activate && cd backend && alembic upgrade head

backend-migration: ## Create a new Alembic migration (usage: make backend-migration msg="description")
	. backend/.venv/bin/activate && cd backend && alembic revision --autogenerate -m "$(msg)"

# ── Testing ──────────────────────────────────────────────────

frontend-test: ## Run frontend tests (Vitest)
	cd frontend && npm test

frontend-test-watch: ## Run frontend tests in watch mode
	cd frontend && npm run test:watch

backend-test: ## Run backend tests (pytest)
	. backend/.venv/bin/activate && cd backend && python -m pytest tests/ -v

backend-test-cov: ## Run backend tests with coverage report
	. backend/.venv/bin/activate && cd backend && python -m pytest tests/ -v --cov=app

test: frontend-test backend-test ## Run all tests (frontend + backend)

# ── Linting ──────────────────────────────────────────────────

frontend-lint: ## Lint frontend (oxlint)
	cd frontend && npm run lint

backend-lint: ## Lint backend with ruff (if installed)
	@echo "Linting backend..."
	@if [ -x "$$(command -v ruff)" ]; then \
		ruff check backend/; \
	else \
		echo "ruff not installed — skipping backend lint"; \
	fi

lint: frontend-lint ## Run all linters

# ── Cleanup ──────────────────────────────────────────────────

frontend-clean: ## Remove frontend build artifacts
	rm -rf frontend/dist

backend-clean: ## Remove Python cache files
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find backend -type f -name '*.pyc' -delete

# ── Keycloak ──────────────────────────────────────────────────

keycloak-start: ## Start Keycloak + Keycloak DB containers
	docker compose up -d keycloak-db keycloak

keycloak-stop: ## Stop and remove Keycloak + Keycloak DB containers
	docker compose down

keycloak-recreate: ## Force-recreate Keycloak containers (picks up config changes)
	docker compose down -v
	docker compose up -d keycloak-db keycloak

keycloak-logs: ## Show logs from the Keycloak container
	docker compose logs -f keycloak

clean: frontend-clean backend-clean ## Remove all build artifacts and caches
