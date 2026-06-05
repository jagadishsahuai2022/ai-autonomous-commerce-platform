# DEPLOYMENT.md - Production Deployment Guide

## 🏢 Production Checklist

Before deploying to production, ensure all items are completed:

### Pre-Deployment

- [ ] All tests passing locally
- [ ] Environment variables configured in `.env.production`
- [ ] Docker images built successfully
- [ ] Security audit completed
- [ ] Database backups configured
- [ ] Monitoring alerts configured
- [ ] SSL/TLS certificates obtained

### Environment Setup

```bash
# Create production environment file
cp .env.example .env.production

# Configure for production
vim .env.production
```

### Critical Production Variables

```env
NODE_ENV=production
API_PORT=3001
WEB_PORT=3000
JWT_SECRET=<generate-strong-secret>
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
LOG_LEVEL=info
```

## 🐳 Docker Production Deployment

### Build Images

```bash
# Build all images
docker-compose build

# Tag for registry
docker tag ai-commerce-api:latest myregistry/ai-commerce-api:1.0.0
docker tag ai-commerce-web:latest myregistry/ai-commerce-web:1.0.0
docker tag ai-commerce-ai-service:latest myregistry/ai-commerce-ai-service:1.0.0

# Push to registry
docker push myregistry/ai-commerce-api:1.0.0
docker push myregistry/ai-commerce-web:1.0.0
docker push myregistry/ai-commerce-ai-service:1.0.0
```

### Deploy Stack

```bash
# Using Docker Compose
docker-compose -f docker-compose.yml up -d

# Using Kubernetes (prepare helm chart)
helm install ai-commerce ./helm/ai-commerce
```

## 🔒 Security Best Practices

### Network Security

```bash
# Use environment variables for secrets
# Never commit .env files
# Use strong passwords (minimum 32 characters)
# Enable SSL/TLS for all communications
```

### Database Security

```sql
-- Create dedicated application user
CREATE USER ai_commerce_app WITH PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE ai_commerce TO ai_commerce_app;
GRANT USAGE ON SCHEMA public TO ai_commerce_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ai_commerce_app;
```

### API Security

- Enable rate limiting
- Implement request signing
- Use API keys/JWT tokens
- Regular security audits

## 📊 Monitoring & Logging

### Health Check Endpoints

```bash
# API
curl http://api.example.com/health

# AI Service
curl http://ai-service.example.com/health

# Web frontend (auto-updated)
curl http://example.com
```

### Log Aggregation

Integrate with ELK stack or CloudWatch:

```bash
# Example with ELK
docker run -d --name elasticsearch docker.elastic.co/elasticsearch/elasticsearch:8.0.0
docker run -d --name kibana docker.elastic.co/kibana/kibana:8.0.0
```

### Metrics Collection

```bash
# Prometheus configuration
docker run -d --name prometheus prom/prometheus
docker run -d --name grafana grafana/grafana
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build images
        run: docker-compose build

      - name: Push to registry
        run: |
          docker push myregistry/ai-commerce-api:${{ github.sha }}
          docker push myregistry/ai-commerce-web:${{ github.sha }}
          docker push myregistry/ai-commerce-ai-service:${{ github.sha }}

      - name: Deploy to production
        run: |
          # Deploy commands here
          helm upgrade ai-commerce ./helm/ai-commerce
```

## 🗄️ Database Backups

### Automated Backups

```bash
# Daily backup script
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$TIMESTAMP.sql.gz

# Upload to S3
aws s3 cp backup_$TIMESTAMP.sql.gz s3://my-backups/
```

### Restore from Backup

```bash
gunzip backup_20240101_000000.sql.gz
psql -h $DB_HOST -U $DB_USER $DB_NAME < backup_20240101_000000.sql
```

## 🚀 Scaling Strategies

### Horizontal Scaling

```yaml
# Docker Swarm
docker service create --name api --replicas 3 myregistry/ai-commerce-api:1.0.0

# Kubernetes
kubectl scale deployment api --replicas 5
```

### Caching Strategy

- Use Redis for session management
- Cache API responses (24 hour TTL)
- Cache AI recommendations

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_orders_status ON orders(status);
```

## 📈 Performance Optimization

### Frontend Optimization

- Enable Next.js cache
- Use image optimization
- Implement code splitting
- Enable gzip compression

### API Optimization

- Add response caching
- Implement pagination
- Use database connection pooling
- Async request handling

### AI Service Optimization

- Cache model predictions
- Batch process recommendations
- Async event processing

## 🆘 Incident Response

### Monitoring Alerts

```bash
# API down alert
- Service: API
- Threshold: Downtime > 1 minute
- Action: Auto-restart + notify team

# High error rate
- Service: All
- Threshold: Error rate > 5%
- Action: Page on-call engineer

# Disk space critical
- Threshold: Usage > 90%
- Action: Auto-cleanup + alert
```

### Rollback Procedure

```bash
# Rollback to previous version
docker pull myregistry/ai-commerce-api:previous-tag
docker-compose up -d  # Will use new image

# Alternative with Kubernetes
kubectl rollout undo deployment/api
```

## 📝 Maintenance Windows

### Scheduled Maintenance

- Weekly: Database optimization (VACUUM, ANALYZE)
- Monthly: Security patches
- Quarterly: Major upgrades

### Zero-Downtime Deployment

```bash
# Blue-Green Deployment
docker-compose -f docker-compose.blue.yml up -d
# Run tests...
docker-compose -f docker-compose.green.yml up -d  # Switch
```

## 📞 Support & Documentation

- **On-Call**: Use PagerDuty or similar
- **Runbooks**: Document all procedures
- **Postmortems**: Document all incidents
- **Knowledge Base**: Maintain FAQs

---

**Last Updated**: April 2026  
**Version**: 1.0.0
