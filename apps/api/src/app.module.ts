import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ProductModule } from './modules/product/product.module';
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { AIChatModule } from './modules/ai-chat/ai-chat.module';
import { BuyRequestModule } from './modules/buy-request/buy-request.module';
import { MobileAuthModule } from './modules/mobile-auth/mobile-auth.module';
import { MobileDevicesModule } from './modules/mobile-devices/mobile-devices.module';
import { PrismaService } from './services/prisma.service';
import { RedisService } from './services/redis.service';
import { LoggerService } from './common/logger.service';
import { KafkaModule } from './kafka/kafka.module';
import { CoreServicesModule } from './common/core-services.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MobileModule } from './modules/mobile/mobile.module';
// import { WebSocketModule } from './websocket/websocket.module'; // TODO: Fix version conflicts

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CoreServicesModule, // Reliability, security, observability
    KafkaModule, // Event-driven architecture
    // WebSocketModule, // Real-time WebSocket updates (disabled due to version conflicts)
    AuthModule,
    ProductModule,
    CartModule,
    OrderModule,
    FeatureFlagModule,
    AIChatModule, // AI Shopping Assistant
    BuyRequestModule, // Smart Buy Request
    MobileAuthModule, // Mobile-only: refresh + phone OTP (stub)
    MobileDevicesModule, // Mobile-only: push token registry (stub)
    MobileModule, // Mobile-compatible REST endpoints (cart, orders, wishlist, profile)
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Core services
    PrismaService,
    RedisService,
    LoggerService,
    Logger,
    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [PrismaService, RedisService, LoggerService],
})
export class AppModule {
  private readonly logger = new Logger('AppModule');

  constructor() {
    this.logger.log('✅ AppModule initialized with Kafka and core services');
  }
}
