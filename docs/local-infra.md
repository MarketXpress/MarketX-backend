# Local Infrastructure (compose profile)

This document describes the minimal local infrastructure profile for day-to-day development.

Profile name: `local-dev`

Included services (compose):
- PostgreSQL (5432)
- Redis (6379)
- RabbitMQ (5672 + management 15672)

Quick start

Run the services in the background:

```bash
docker compose --profile local-dev up -d
```

Stop and remove the containers:

```bash
docker compose --profile local-dev down
```

View logs:

```bash
docker compose --profile local-dev logs -f
```

Check running containers and health:

```bash
docker compose --profile local-dev ps
```

Environment

The compose file uses the repository's environment variables with sensible defaults (see `docker-compose.yml`). To override values, create a `.env` file in the repository root or export variables in your shell. Important vars:

- `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`
- `AMQP_URL`

Notes

- The `api` service is not included in this profile: run the API locally (e.g., `npm run start:dev`) and point it to the services above.
- Ports used by the profile are bound to localhost. If you already have these ports in use, stop the conflicting services or update the `.env` overrides.

Troubleshooting

- If a service fails health checks on startup, view that service logs (e.g., `docker compose logs postgres`) and confirm `.env` values if customized.
- To reset volumes (data will be lost):

```bash
docker compose --profile local-dev down -v
```

If you'd like, I can add make/npm scripts to simplify these commands.
