# COMMANDS.md - Quick Reference Guide

## ⚡ Most Common Commands

### 🚀 Getting Started (First Time)

```bash
# 1. Install everything
npm install

# 2. Create .env from template
cp .env.example .env

# 3. Start all services
npm run dev

# Access:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001/health
# - AI: http://localhost:8000/health
```

## 🏃 Development Commands

### Running Services

```bash
# All three apps together
npm run dev

# Only frontend
npm run dev:web

# Only API
npm run dev:api

# Only AI service (requires Python setup)
cd apps/ai-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Building

```bash
# Build all applications
npm run build

# Build only specific app
npm run build --filter=web
npm run build --filter=api
npm run build --filter=ai-service
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format

# Check formatting (no changes)
npm run format:check
```

## 🐳 Docker Commands

### Development with Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f ai-service

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild images
docker-compose build

# Rebuild without cache
docker-compose build --no-cache
```

### Individual Service Management

```bash
# Start specific service
docker-compose up -d api

# Stop specific service
docker-compose stop api

# Restart service
docker-compose restart api

# View service status
docker-compose ps
```

## 📁 Workspace Navigation

```bash
# Navigate to frontend
cd apps/web

# Navigate to API
cd apps/api

# Navigate to AI service
cd apps/ai-service

# From any subdirectory, go to root
cd ../..
```

## 🗄️ Database Commands

### PostgreSQL Access

```bash
# Connect to PostgreSQL (with Docker)
docker exec -it dc-latest-postgres psql -U admin -d delegatecart

# From inside container:
\dt                    # List tables
\d table_name         # Show table structure
SELECT * FROM users;  # Query data
\q                    # Quit
```

### Database Backup & Restore

```bash
# Backup database
docker exec dc-latest-postgres pg_dump -U admin delegatecart > backup.sql

# Restore database
docker exec -i dc-latest-postgres psql -U admin delegatecart < backup.sql
```

## 💾 Redis Commands

```bash
# Connect to Redis (with Docker)
docker exec -it ai-commerce-redis redis-cli

# Useful commands:
KEYS *              # List all keys
GET key_name        # Get value
SET key_name value  # Set value
DEL key_name        # Delete key
FLUSHALL            # Clear all keys
```

## 📨 Kafka Commands

```bash
# List topics (with Docker)
docker exec ai-commerce-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Create topic
docker exec ai-commerce-kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --create \
  --topic test-topic \
  --partitions 1 \
  --replication-factor 1

# Send message
docker exec -it ai-commerce-kafka kafka-console-producer \
  --broker-list localhost:9092 \
  --topic test-topic

# Consume messages
docker exec -it ai-commerce-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic test-topic \
  --from-beginning
```

## 🔍 API Testing

### Health Checks

```bash
# API health
curl http://localhost:3001/health

# AI service health
curl http://localhost:8000/health

# Get recommendations
curl http://localhost:8000/recommend/1
```

### Using curl

```bash
# GET request
curl http://localhost:3001/products

# POST request
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}'

# GET with parameters
curl "http://localhost:3001/orders/1"
```

### Using Thunder Client / Postman

Store these base URLs:

- API: `http://localhost:3001`
- AI: `http://localhost:8000`
- Frontend: `http://localhost:3000`

## 🧹 Cleanup Commands

```bash
# Remove node_modules from all apps
npm run clean

# Remove Docker containers
docker-compose down

# Remove Docker containers and volumes
docker-compose down -v

# Clear npm cache
npm cache clean --force

# Remove build artifacts
rm -rf apps/*/dist
rm -rf apps/web/.next
```

## 🔐 Environment & Secrets

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
vim .env    # or use your editor

# Key variables to set:
# DB_PASSWORD
# JWT_SECRET
# REDIS_PASSWORD
```

## 📦 Dependency Management

### NPM Workspace Commands

```bash
# Install package in specific app
npm install package-name --workspace=web
npm install package-name --workspace=api

# Or navigate to app first
cd apps/web
npm install package-name

# Update all dependencies
npm update

# Check for outdated packages
npm outdated
```

### Python Pip Commands

```bash
# Navigate to AI service
cd apps/ai-service

# Install requirements
pip install -r requirements.txt

# Add new package
pip install package-name
pip freeze > requirements.txt  # Update requirements
```

## 💡 Useful File Edits

### Change Frontend Port

Edit `apps/web/package.json`:

```json
"dev": "next dev --port 3000"
```

### Change API Port

Edit `apps/api/src/main.ts`:

```typescript
const port = process.env.API_PORT || 3001;
```

### Change AI Port

Edit `apps/ai-service/app/main.py`:

```python
uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 🐛 Debugging

### Frontend Debugging

```bash
# Check console in browser
# DevTools: F12 or Ctrl+Shift+I (Windows) / Cmd+Option+I (Mac)
# Check network tab for API calls
```

### API Debugging

```bash
# Enable debug logging
DEBUG=* npm run dev:api

# View API logs in terminal
npm run dev:api
```

### Python Debugging

```bash
# Simple print debugging
print("Debug value:", value)

# Using pdb
import pdb; pdb.set_trace()

# Run with verbose logging
python -m uvicorn app.main:app --reload --log-level debug
```

## 📊 Monitoring

### View All Running Services

```bash
# Docker
docker-compose ps

# Process list (Linux/Mac)
ps aux | grep "node\|python"

# Windows
tasklist | findstr "node python"
```

### Port Status

```bash
# Windows
netstat -ano | findstr "3000\|3001\|8000\|5432"

# Linux/Mac
lsof -i :3000
lsof -i :3001
lsof -i :8000
```

## 🚫 Troubleshooting Commands

### Port Already in Use (Windows)

```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

### Port Already in Use (Linux/Mac)

```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Clear Everything and Restart

```bash
npm run clean
rm -rf node_modules
npm install
npm run dev
```

## 🔗 File Navigation

```bash
# Root files
ls -la

# Apps
ls apps/

# Specific app
ls apps/web/app/

# Packages
ls packages/

# Infrastructure
ls infra/docker/
```

## 📝 Useful Aliases (Linux/Mac)

Add to `.bashrc` or `.zshrc`:

```bash
alias dev='npm run dev'
alias build='npm run build'
alias lint='npm run lint'
alias format='npm run format'
alias dc='docker-compose'
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
```

Then reload: `source ~/.bashrc` or `source ~/.zshrc`

## 🎯 Daily Workflow

```bash
# Morning: Start fresh
npm run clean
npm install
npm run dev

# Code changes (auto-reload with npm run dev)
# Just save files, changes appear automatically

# Before committing
npm run type-check
npm run lint
npm run format

# Commit
git add .
git commit -m "feat: your feature"
```

## 📞 Getting Help

```bash
# Check command help
npm run --help
npm -- --help

# List all turbo tasks
npx turbo run --help

# Help with specific package
cd apps/api && npm run --scripts
```

---

**Last Updated**: April 2026  
**Keep this handy while developing!** 📚
