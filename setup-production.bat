@echo off
REM Production Setup Script for DelegateCart (Windows)
REM This script automates the setup of DelegateCart for production environment

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo DelegateCart Production Setup - Windows
echo ========================================
echo.

REM Color codes for output
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "RESET=[0m"

REM Check prerequisites
echo [*] Checking prerequisites...

where /q node >nul 2>nul
if !errorlevel! neq 0 (
    echo %RED%[ERROR] Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/%RESET%
    exit /b 1
)
echo %GREEN%[OK] Node.js is installed%RESET%

where /q pnpm >nul 2>nul
if !errorlevel! neq 0 (
    echo %YELLOW%[INFO] pnpm is not installed globally. Installing...%RESET%
    call npm install -g pnpm
    if !errorlevel! neq 0 (
        echo %RED%[ERROR] Failed to install pnpm%RESET%
        exit /b 1
    )
)
echo %GREEN%[OK] pnpm is installed%RESET%

where /q docker >nul 2>nul
if !errorlevel! equ 0 (
    echo %GREEN%[OK] Docker is installed%RESET%
) else (
    echo %YELLOW%[WARNING] Docker is not installed. Docker is optional but recommended%RESET%
    echo Install from https://www.docker.com/products/docker-desktop
)

where /q kubectl >nul 2>nul
if !errorlevel! equ 0 (
    echo %GREEN%[OK] kubectl is installed%RESET%
) else (
    echo %YELLOW%[WARNING] kubectl is not installed. Kubernetes is optional%RESET%
    echo Install from https://kubernetes.io/docs/tasks/tools/
)

echo.
echo [*] Installing dependencies...
call pnpm install
if !errorlevel! neq 0 (
    echo %RED%[ERROR] Failed to install dependencies%RESET%
    exit /b 1
)
echo %GREEN%[OK] Dependencies installed%RESET%

echo.
echo [*] Creating environment configuration...

if not exist ".env.production" (
    if exist ".env.production.example" (
        copy ".env.production.example" ".env.production"
        echo %GREEN%[OK] Created .env.production from template%RESET%
        echo %YELLOW%[WARNING] Please update sensitive values in .env.production:%RESET%
        echo   - JWT_SECRET: Change to a secure random string
        echo   - DATABASE_PASSWORD: Set to your PostgreSQL password
        echo   - REDIS_PASSWORD: Set to your Redis password
        echo   - KAFKA_PASSWORD: Set to your Kafka password
    ) else (
        echo %RED%[ERROR] .env.production.example not found%RESET%
        exit /b 1
    )
) else (
    echo %YELLOW%[INFO] .env.production already exists%RESET%
)

echo.
echo [*] Setting up database...
cd /d "%~dp0\apps\api"

echo [*] Running database migrations...
call npx prisma migrate deploy
if !errorlevel! neq 0 (
    echo %RED%[ERROR] Database migration failed%RESET%
    echo Ensure PostgreSQL is running and connection string is correct
    exit /b 1
)
echo %GREEN%[OK] Database migrations completed%RESET%

echo.
echo [*] Seeding demo data...
call npx prisma db seed
if !errorlevel! neq 0 (
    echo %RED%[ERROR] Database seeding failed%RESET%
    exit /b 1
)
echo %GREEN%[OK] Demo data seeded%RESET%

echo.
echo [*] Creating production indexes...
echo [INFO] This may take a few minutes for large databases...
REM Run index creation via prisma query
call npx prisma db execute --stdin < " %~dp0apps\api\prisma\migrations\add_production_indexes.sql"
if !errorlevel! equ 0 (
    echo %GREEN%[OK] Production indexes created%RESET%
) else (
    echo %YELLOW%[WARNING] Index creation skipped or partial. Indexes can be created manually.%RESET%
)

cd /d "%~dp0"

echo.
echo [*] Building application...
call pnpm build
if !errorlevel! neq 0 (
    echo %RED%[ERROR] Build failed%RESET%
    echo Check the output above for errors
    exit /b 1
)
echo %GREEN%[OK] Build completed%RESET%

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo [+] Next steps:
echo.
echo 1. Development:
echo    pnpm dev              - Run all services in development mode
echo    pnpm dev:api          - Run only API service
echo    pnpm dev:web          - Run only web service
echo.
echo 2. Testing:
echo    pnpm test             - Run all tests
echo    pnpm test:integration - Run integration tests
echo    pnpm load-test        - Run load test (requires k6)
echo.
echo 3. Database:
echo    pnpm db:studio        - Open Prisma Studio to explore database
echo    pnpm db:seed          - Re-seed demo data
echo    pnpm db:reset         - Reset database and reseed
echo.
echo 4. Deployment:
echo    pnpm docker:up        - Start Docker containers
echo    pnpm k8s:deploy       - Deploy to Kubernetes
echo    pnpm health           - Check API health
echo.
echo 5. Monitoring:
echo    http://localhost:9090/metrics   - Prometheus metrics
echo    http://localhost:5555           - Jaeger tracing (if enabled)
echo.
echo Demo Users (for testing):
echo   Email: john@demo.com / Password: demo123
echo   Email: priya@demo.com / Password: demo123
echo   (All demo users use same password)
echo.
echo Configuration:
echo   API: http://localhost:3000
echo   Web: http://localhost:3001
echo   Database: localhost:5432
echo   Redis: localhost:6379
echo.
echo Documentation:
echo   - See PRODUCTION_UPGRADE_GUIDE.md for detailed information
echo   - See .env.production.example for all configuration options
echo.
echo ========================================

endlocal
