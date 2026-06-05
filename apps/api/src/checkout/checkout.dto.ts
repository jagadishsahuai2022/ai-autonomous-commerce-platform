import { IsString, IsNumber, IsArray, IsEnum, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  PREMIUM = 'premium',
}

export interface CheckoutSession {
  items: CartItem[];
  addressId: string;
  shippingMethod: ShippingMethod;
  paymentMethod: string;
  appliedCoupons: string[];
  notes: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

export class ValidateCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsString()
  addressId: string;

  @IsEnum(ShippingMethod)
  shippingMethod: ShippingMethod;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  appliedCoupons?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CartItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsString()
  addressId: string;

  @IsEnum(ShippingMethod)
  shippingMethod: ShippingMethod;

  @IsString()
  paymentMethod: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  appliedCoupons?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckoutPreviewDto {
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  items: CartItem[];
  address: any;
  shippingMethod: ShippingMethod;
  estimatedDelivery: string;
}
