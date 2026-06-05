/**
 * WebSocket Module - Exports all WebSocket components
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { KafkaConsumerBridge } from './kafka-websocket.bridge';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [WebSocketGateway, WebSocketService, KafkaConsumerBridge],
  exports: [WebSocketGateway, WebSocketService],
})
export class WebSocketModule {}
