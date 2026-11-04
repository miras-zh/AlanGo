.PHONY: run build test tidy docker-up docker-down web-dev mobile-dev

# Start Go API locally (reads .env)
run:
	go run ./cmd/app

# Compile Go API binary
build:
	go build -o ./bin/server ./cmd/app

# Run all backend unit tests
test:
	go test ./...

# Tidy Go module dependencies
tidy:
	go mod tidy

# Start full stack (Postgres, Redis, API, Web, Caddy) in Docker
docker-up:
	docker compose -f docker/docker-compose.yaml --env-file .env up -d --build

docker-down:
	docker compose -f docker/docker-compose.yaml down

# Start Next.js web client locally
web-dev:
	cd ui/web && npm run dev

# Start Expo mobile app locally
mobile-dev:
	cd ui/mobile && npx expo start
