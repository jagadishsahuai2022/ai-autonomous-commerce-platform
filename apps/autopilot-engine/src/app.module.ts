/**
 * Main Application Module
 * Root NestJS module for autopilot-engine service
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AutopilotEngineModule } from './services/autopilot-engine.module';
import { KafkaModule } from './kafka/kafka.module';
import { AutopilotController } from './controllers/autopilot.controller';
import { OpsModule } from './ops/ops.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AutopilotEngineModule,
    KafkaModule,
    OpsModule,
  ],
  controllers: [AutopilotController],
})
export class AppModule {}
