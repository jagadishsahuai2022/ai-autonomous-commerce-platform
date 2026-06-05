# Environment Configuration Examples

## Backend (.env for NestJS API)

```env
# Server
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# WebSocket
WEBSOCKET_PORT=3002
WEBSOCKET_TRANSPORTS=websocket,polling
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
WEBSOCKET_ENABLED=true

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-in-production
JWT_TOKEN_ENABLED=true
JWT_EXPIRES_IN=24h

# Kafka Event Streaming
KAFKA_BROKERS=kafka:29092
KAFKA_CLIENT_ID=delegatecart-api
KAFKA_GROUP_ID=api-consumer-group
KAFKA_LOG_LEVEL=4  # 0=NOTHING, 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG

# Kafka Topics
KAFKA_TOPIC_PRODUCT_EVENTS=product-events
KAFKA_TOPIC_COMMERCE_EVENTS=commerce-events
KAFKA_TOPIC_USER_BEHAVIOR=user-behavior
KAFKA_TOPIC_ML_EVENTS=ml-events
KAFKA_TOPIC_RECOMMENDATIONS=recommendations
KAFKA_TOPIC_ANALYTICS=analytics

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/delegatecart

# Redis Cache
REDIS_URL=redis://redis:6379
REDIS_DEFAULT_TTL=3600

# Python AI Service
AI_SERVICE_URL=http://ai-service:8000
AI_SERVICE_TIMEOUT=30000

# Feature Flags
FEATURE_REAL_TIME_ENABLED=true
FEATURE_WEBSOCKET_ENABLED=true
FEATURE_KAFKA_ENABLED=true

# Monitoring
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
DATADOG_ENABLED=false
```

## Frontend (.env.local for Next.js)

```env
# App
NEXT_PUBLIC_APP_NAME=DelegateCart
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API Storage
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_TIMEOUT=30000

# WebSocket
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3002
NEXT_PUBLIC_WEBSOCKET_ENABLED=true
NEXT_PUBLIC_WEBSOCKET_AUTO_CONNECT=true
NEXT_PUBLIC_WEBSOCKET_RECONNECT_ATTEMPTS=10

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-change-in-production
NEXTAUTH_PROVIDERS=github,google

# OAuth Providers (if using)
NEXT_PUBLIC_GITHUB_ID=your-github-id
GITHUB_SECRET=your-github-secret

NEXT_PUBLIC_GOOGLE_ID=your-google-id
GOOGLE_SECRET=your-google-secret

# Analytics
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-key@sentry.io/project-id

# Feature Flags
NEXT_PUBLIC_FEATURE_REAL_TIME=true
NEXT_PUBLIC_FEATURE_RECOMMENDATIONS=true
```

## Python AI Service (`.env` or environment variables)

```env
# Server
FASTAPI_ENV=development
FASTAPI_DEBUG=true
FASTAPI_LOG_LEVEL=DEBUG
HOST=0.0.0.0
PORT=8000

# Kafka
KAFKA_BROKERS=kafka:29092
KAFKA_CONSUMER_GROUP=ai-service-consumer
KAFKA_AUTO_OFFSET_RESET=earliest
KAFKA_SESSION_TIMEOUT_MS=30000

# Kafka Topics to consume
KAFKA_TOPICS=product-events,commerce-events,user-behavior

# AI / ML Configuration
MODEL_PATH=/app/models/recommendation_model.pkl
MIN_CONFIDENCE_SCORE=0.5
MAX_RECOMMENDATIONS_PER_USER=10

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/delegatecart
DATABASE_POOL_SIZE=10

# Redis Cache
REDIS_URL=redis://redis:6379
REDIS_CACHE_TTL=3600

# Monitoring
LOG_FILE=/logs/ai-service.log
METRICS_ENABLED=true

# Behavior Engine
BEHAVIOR_TRACKING_ENABLED=true
ORDER_PROCESSING_ENABLED=true
```

## Docker Compose Environment (.env for docker-compose)

```env
# Service Versions
POSTGRES_VERSION=15-alpine
REDIS_VERSION=7-alpine
KAFKA_VERSION=7.5.0-scala2.13
ZOOKEEPER_VERSION=7.5.0

# Database
POSTGRES_USER=delegatecart
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=delegatecart

# Redis
REDIS_PASSWORD=your-redis-password

# Kafka
KAFKA_BROKER_ID=1
KAFKA_ADVERTISED_HOST_NAME=kafka
KAFKA_ADVERTISED_PORT=29092
KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181

# Network
NETWORK_NAME=ai-commerce-network
SHARED_NETWORK=ai-commerce-shared

# Logging
LOG_LEVEL=INFO
```

## Production Configuration

### Security Hardening

```env
# Production - NestJS API
NODE_ENV=production
PORT=3001
WEBSOCKET_PORT=3002

# HTTPS/TLS
ENABLE_HTTPS=true
SSL_CERT_PATH=/etc/ssl/certs/server.crt
SSL_KEY_PATH=/etc/ssl/private/server.key

# CORS - Restrict to production domain
CORS_ORIGINS=https://delegatecart.com,https://app.delegatecart.com

# JWT - Use strong secret
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=12h

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Database - Production instance
DATABASE_URL=postgresql://prod-user:strong-pass@prod-db-host:5432/delegatecart-prod
DATABASE_SSL_ENABLED=true

# monitoring
SENTRY_DSN=https://xxxx@sentry.io/project
DATADOG_ENABLED=true
DATADOG_API_KEY=your-datadog-key

# WebSocket - Production optimizations
WEBSOCKET_TRANSPORTS=websocket  # WebSocket only, no polling
WEBSOCKET_MAX_CONNECTIONS=10000
WEBSOCKET_CONNECTION_TIMEOUT=10000
```

## Staging Configuration

```env
# Staging - NestJS API
NODE_ENV=staging
PORT=3001
WEBSOCKET_PORT=3002

# CORS - Staging domain
CORS_ORIGINS=https://staging-delegatecart.com

# Database - Staging copy
DATABASE_URL=postgresql://staging-user:staging-pass@staging-db:5432/delegatecart-staging

# JWT - Different secret
JWT_SECRET=$(openssl rand -hex 32)

# Monitoring - Disable some features
SENTRY_ENABLED=true
DATADOG_ENABLED=false
```

## Local Development

```env
# Local - NestJS API
NODE_ENV=development
PORT=3001
WEBSOCKET_PORT=3002

# CORS - All local ports
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:4200

# JWT
JWT_SECRET=local-development-key
JWT_TOKEN_ENABLED=true

# Database - Docker
DATABASE_URL=postgresql://delegatecart:delegatecart@localhost:5432/delegatecart

# Kafka - Docker
KAFKA_BROKERS=localhost:9092

# Logging
LOG_LEVEL=debug

# Debugging
DEBUG=delegatecart:*
```

---

## Deployment Checklist

### Environment Setup

- [ ] Generate strong JWT_SECRET (use `openssl rand -hex 32`)
- [ ] Setup SSL certificates for HTTPS
- [ ] Configure CORS for your domain
- [ ] Setup database backups
- [ ] Configure Redis persistence
- [ ] Setup Kafka brokers with replication

### Network & Security

- [ ] Setup firewall rules (3001, 3002 for backend/WebSocket)
- [ ] Enable VPC/private networks
- [ ] Setup WAF (Web Application Firewall)
- [ ] Enable DDoS protection
- [ ] Configure rate limiting

### Monitoring & Logging

- [ ] Setup Sentry for error tracking
- [ ] Setup DataDog/New Relic for monitoring
- [ ] Configure log aggregation (ELK, CloudWatch)
- [ ] Setup performance monitoring
- [ ] Create alerts for critical issues

### Scaling

- [ ] Use Redis adapter for Socket.IO clustering
- [ ] Load balance with Nginx/HAProxy
- [ ] Setup database connection pooling
- [ ] Configure Kafka partitions for scale
- [ ] Setup auto-scaling policies

---

## Quick Start Commands

### Local Development

```bash
# Copy template to .env
cp .env.example .env

# Update with your values
nano .env

# Start Docker services
docker-compose up -d

# API should be running on 3001
# WebSocket on 3002
# Next.js frontend on 3000
```

### Production Deployment

```bash
# Generate SSL certificates
certbot certonly --standalone -d delegatecart.com

# Generate JWT secret
openssl rand -hex 32 > jwt_secret.txt

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Verify services
curl https://api.delegatecart.com/health
```
