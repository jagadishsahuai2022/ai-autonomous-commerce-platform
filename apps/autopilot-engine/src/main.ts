/**
 * Application Entry Point
 */

import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        }));
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: messages,
        });
      },
    })
  );

  // Set API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3002;

  await app.listen(port);

  /* eslint-disable no-console */
  console.log(`🚀 Autopilot Engine running on http://localhost:${port}`);
  console.log(`📚 API available at http://localhost:${port}/api/v1`);
  console.log(`🔗 OpenAPI docs at http://localhost:${port}/api`);
  /* eslint-enable no-console */
}

bootstrap();
