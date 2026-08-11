# Makefile for Kanak AI development

.PHONY: help setup up down restart logs clean test test-integration

help: ## Show this help message
	@echo "Kanak AI Development Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Initial setup (copy .env.example, install deps)
	@echo "Setting up Kanak AI development environment..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✓ Created .env from .env.example"; \
	else \
		echo "✓ .env already exists"; \
	fi
	@echo "✓ Setup complete. Run 'make up' to start services."

up: ## Start all services
	docker compose up -d
	@echo ""
	@echo "✓ Services starting..."
	@echo "  API: http://localhost:8080"
	@echo "  Web: http://localhost:3000"
	@echo "  MinIO Console: http://localhost:9001"
	@echo ""
	@echo "Run 'make logs' to view logs"

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

logs: ## Tail logs for all services
	docker compose logs -f

logs-api: ## Tail API logs only
	docker compose logs -f api

logs-web: ## Tail web logs only
	docker compose logs -f web

ps: ## Show running containers
	docker compose ps

clean: ## Stop and remove all containers, volumes, and images
	docker compose down -v --rmi local
	@echo "✓ All containers, volumes, and images removed"

test-integration: ## Run integration tests
	@echo "Running M1-T1 integration tests..."
	cd tests/integration && npm install && npm test

test: test-integration ## Alias for test-integration

shell-api: ## Open shell in API container
	docker compose exec api sh

shell-db: ## Open PostgreSQL shell
	docker compose exec postgres psql -U kanak -d kanak

shell-redis: ## Open Redis CLI
	docker compose exec redis redis-cli

health: ## Check health of all services
	@echo "Checking service health..."
	@curl -s http://localhost:8080/health | jq '.' || echo "API not responding"
	@curl -s http://localhost:3000 > /dev/null && echo "✓ Web is up" || echo "✗ Web is down"
	@curl -s http://localhost:9000/minio/health/live > /dev/null && echo "✓ MinIO is up" || echo "✗ MinIO is down"
