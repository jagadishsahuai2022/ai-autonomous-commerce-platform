# Express vs Fastify — DelegateCart NestJS API Analysis

## Current State

| Property | Value |
|---|---|
| Framework | **Express** (default NestJS adapter) |
| NestJS Version | `@nestjs/core@11.1.19`, `@nestjs/common@11.1.19` |
| Platform Package | `@nestjs/platform-express@11.1.19` |
| Express Types | `@types/express@^4.17.21` |
| Bootstrap | `NestFactory.create(AppModule)` (implicit Express) |
| Entry File | `apps/api/src/main.ts` |

## Files Importing Directly from Express

These 11 files use Express-specific `Request`, `Response`, or `NextFunction` types:

| File | Imports |
|---|---|
| `src/main.ts` | Implicit `(req, res, next)` in security header middleware |
| `src/app.controller.ts` | `Response` |
| `src/shopping/chat.controller.ts` | `Response` |
| `src/modules/agent/agent.controller.ts` | `Response` |
| `src/common/filters/global-exception.filter.ts` | `Request`, `Response` |
| `src/common/interceptors/logging.interceptor.ts` | `Request`, `Response` |
| `src/common/middleware/rate-limiting.middleware.ts` | `Request`, `Response`, `NextFunction` |
| `src/common/middleware/reliability.middleware.ts` | `Request`, `Response`, `NextFunction` |
| `src/common/services/csrf-protection.service.ts` | `Request` |
| `src/common/services/observability.service.ts` | `Request`, `Response`, `NextFunction` |
| `src/common/guards/jwt.guard.ts` | `Request` |
| `src/common/guards/production-guards.ts` | `Request` |

## Express-Specific Patterns in Use

1. **`app.use((req, res, next) => ...)` middleware** in `main.ts` for security headers
2. **`@Res() res: Response`** decorator pattern for streaming chat responses (`chat.controller.ts`, `agent.controller.ts`)
3. **`res.setHeader()` / `res.write()` / `res.end()`** direct response manipulation for SSE/streaming
4. **`req.ip` / `req.headers`** access in rate-limiting and logging middleware
5. **CORS configuration** via `app.enableCors()` (NestJS abstraction, works with both adapters)

## Upgrade Plan: Express → Fastify

### Why Consider Fastify?

| Metric | Express | Fastify |
|---|---|---|
| Requests/sec (hello world) | ~15,000 | ~45,000 |
| JSON serialization | Manual | Schema-based (3× faster) |
| Plugin system | Middleware chain | Encapsulated plugin tree |
| Schema validation | External (class-validator) | Built-in (Ajv) |
| TypeScript support | Via @types | First-class |
| Active maintenance | Low (Express 5 in beta since 2014) | Active, regular releases |

### Migration Steps

#### Phase 1: Package Swap (Low Risk)

```bash
# In apps/api/
pnpm remove @nestjs/platform-express @types/express
pnpm add @nestjs/platform-fastify
```

Update `main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  // ... rest of config
  await app.listen(port, '0.0.0.0'); // Fastify requires explicit host
}
```

#### Phase 2: Type Migration (11 files)

Replace Express imports with Fastify equivalents:

```typescript
// Before
import { Request, Response, NextFunction } from 'express';

// After
import { FastifyRequest, FastifyReply } from 'fastify';
```

Key differences:
- `res.json()` → `reply.send()` (both work in NestJS, but direct access differs)
- `res.setHeader()` → `reply.header()`
- `res.write()` / `res.end()` → `reply.raw.write()` / `reply.raw.end()` (for SSE streaming)
- `req.ip` → `request.ip` (same concept, different object)

#### Phase 3: Middleware Adaptation (4 files)

NestJS middleware with `(req, res, next)` signature needs updating:
- `rate-limiting.middleware.ts` — Use `FastifyRequest`/`FastifyReply`
- `reliability.middleware.ts` — Same
- `observability.service.ts` — Same
- `main.ts` security headers — Replace `app.use()` with Fastify hook

#### Phase 4: Streaming Response Fix (2 files)

The `chat.controller.ts` and `agent.controller.ts` use `@Res() res: Response` for SSE streaming.
With Fastify, you need `@Res() reply: FastifyReply` and `reply.raw.write()`.

### Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| SSE/streaming breaks | **High** | Test chat + agent streaming thoroughly; use `reply.raw` |
| Middleware incompatibility | Medium | Test rate-limiting, CSRF under load |
| Type mismatches | Low | TypeScript will catch at compile time |
| Docker image size | None | Fastify is smaller than Express |
| NestJS compatibility | None | Official `@nestjs/platform-fastify` is first-party |

### Recommendation

**Do NOT migrate now.** Rationale:

1. The app is in active feature development — a framework swap adds risk with zero user-visible benefit
2. Express performance is adequate for current scale (PostgreSQL/Kafka are the bottlenecks, not HTTP routing)
3. The 11 files with direct Express imports create non-trivial migration work
4. SSE streaming in chat/agent controllers requires careful testing
5. NestJS abstracts most Express specifics — the actual performance delta in a real app (with DB, Kafka, Redis) is negligible

**When to migrate:** Consider Fastify when:
- Sustained throughput exceeds 10K req/s on the API
- Express 4.x reaches EOL and Express 5 remains unstable
- A major NestJS version bump makes migration friction-free
