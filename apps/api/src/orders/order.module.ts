import { Module } from '@nestjs/common';
import { OrderService } from './order.service';

// DEPRECATED: This module no longer registers OrderController.
// The active order controller lives at src/modules/order/order.module.ts.
// This stub is kept only for backward-compatible imports during migration.
@Module({
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
