import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
// DEPRECATED: This service uses old TypeORM pattern
// Use modules/order/order.service.ts instead
import { OrderStatus, ShippingMethod, PaymentMethod } from './order.entity';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  OrderResponseDto,
  OrderListResponseDto,
} from './order.dto';

/**
 * DEPRECATED: This service is no longer used.
 * Use modules/order/order.service.ts instead.
 * This stub is here to prevent import errors during refactoring.
 */
@Injectable()
export class OrderService {
  constructor() {
    // Stub - no dependencies
  }

  // Stub methods - use modules/order/order.service
  async create(userId: string, createOrderDto: CreateOrderDto): Promise<any> {
    throw new Error('OrderService.create - Use modules/order/order.service instead');
  }

  async findByUser(userId: string, limit?: number, offset?: number): Promise<any> {
    return { orders: [], total: 0 };
  }

  async findOne(id: string, userId: string): Promise<any> {
    return null;
  }

  async findByOrderNumber(orderNumber: string, userId: string): Promise<any> {
    return null;
  }

  async updateStatus(
    id: string,
    userId: string,
    updateStatusDto: UpdateOrderStatusDto
  ): Promise<any> {
    return null;
  }

  async cancel(id: string, userId: string): Promise<any> {
    return null;
  }

  async getTracking(id: string, userId: string): Promise<any> {
    return null;
  }

  async findByStatus(status: OrderStatus, limit?: number, offset?: number): Promise<any> {
    return { orders: [], total: 0 };
  }

  async search(query: string, limit?: number, offset?: number): Promise<any> {
    return { orders: [], total: 0 };
  }
}
