# Infrastructure

Infrastructure setup for the AI Commerce Platform including Docker, databases, and message queues.

## Docker

### Development

```bash
docker-compose up -d
```

### Production Build

```bash
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d
```

## Services

- **PostgreSQL**: Port 5432 (database)
- **Redis**: Port 6379 (cache)
- **Kafka**: Port 9092 (message broker)
- **Zookeeper**: Port 2181 (Kafka coordinator)
- **API**: Port 3001 (NestJS)
- **Web**: Port 3000 (Next.js)
- **AI Service**: Port 8000 (FastAPI)

## Utilities

- **Kafka UI**: Port 8080 (Kafka monitoring)
