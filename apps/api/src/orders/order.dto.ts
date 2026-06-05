import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, ShippingMethod, PaymentMethod } from './order.entity';

export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  productName: string;

  @IsNumber()
  @IsOptional()
  discountPrice?: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsUUID()
  addressId: string;

  @IsEnum(ShippingMethod)
  shippingMethod: ShippingMethod;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @Min(0)
  tax: number;

  @IsNumber()
  @Min(0)
  shippingCost: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class OrderResponseDto {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  addressId: string;
  notes?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  items: any[];
  createdAt: Date;
  updatedAt: Date;
}

export class OrderListResponseDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  shippingMethod: ShippingMethod;
  estimatedDelivery?: Date;
  itemCount: number;
  createdAt: Date;
}
