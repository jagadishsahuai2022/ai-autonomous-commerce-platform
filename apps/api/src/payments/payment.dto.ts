import { IsString, IsNumber, IsEnum, IsOptional, IsJSON } from 'class-validator';

export enum PaymentMethod {
  RAZORPAY = 'razorpay',
  STRIPE = 'stripe',
  WALLET = 'wallet',
  UPI = 'upi',
  NETBANKING = 'netbanking',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsJSON()
  metadata?: any;
}

export class InitiatePaymentDto {
  @IsString()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}

export class VerifyPaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  transactionId: string;

  @IsOptional()
  @IsJSON()
  response?: any;
}

export class PaymentResponseDto {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  transactionId: string;
  status: string;
  failureReason?: string;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export class RazorpayInitResponse {
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  currency: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
}
