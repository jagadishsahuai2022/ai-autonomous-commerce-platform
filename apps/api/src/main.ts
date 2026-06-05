import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerService } from './common/logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const logger = new Logger('Bootstrap');
  const appLogger = new LoggerService();

  // Register global exception filter - MUST be first
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Register logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global validation pipe with strict settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false,
    })
  );

  // Enable CORS for frontend with security headers
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests from localhost/127.0.0.1 (any port) for development
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      // Allow Expo / React Native dev origins (mobile app)
      // - exp://... (Expo Go)
      // - http://<lan-ip>:8081 (Metro bundler)
      if (/^exp:\/\//.test(origin) || /^https?:\/\/[\d.]+:8081$/.test(origin)) {
        return callback(null, true);
      }
      // Allow one or more origins configured via CORS_ORIGIN (comma-separated for multiple)
      const allowedOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Add security headers via Fastify hook
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onSend', (request: any, reply: any, payload: any, done: () => void) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    done();
  });

  const port = process.env.API_PORT || 3001;
  await app.listen(port, '0.0.0.0');

  appLogger.log('Application Started', {
    port,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    platform: 'fastify',
  });

  logger.log(`✅ API running on http://localhost:${port} (Fastify)`);
  logger.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error.stack);
  process.exit(1);
});
