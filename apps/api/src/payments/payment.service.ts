import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm'; // TODO: Use Prisma
// import { Repository } from 'typeorm'; // TODO: Use Prisma
// import { Payment } from './payment.entity'; // DEPRECATED
import { CreatePaymentDto, VerifyPaymentDto, PaymentMethod, PaymentStatus } from './payment.dto';
import * as crypto from 'crypto';

/**
 * DEPRECATED: This service is no longer used.
 * Use Prisma service from modules instead.
 * This stub is here to prevent import errors during refactoring.
 */
@Injectable()
export class PaymentService {
  private readonly razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
  private readonly razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';

  constructor() {
    // Stub - no dependencies
  }

  /**
   * Create a payment record
   */
  async create(createPaymentDto: CreatePaymentDto): Promise<any> {
    throw new Error('PaymentService.create - Use Prisma implementation instead');
  }

  async verify(verifyPaymentDto: VerifyPaymentDto): Promise<any> {
    throw new Error('PaymentService.verify - Use Prisma implementation instead');
  }

  async initiateRazorpayPayment(
    orderId: string,
    amount: number,
    userEmail: string,
    userPhone: string,
    userName: string
  ): Promise<any> {
    throw new Error('PaymentService.initiateRazorpayPayment - Use Prisma implementation instead');
  }

  async verifyRazorpayPayment(
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<any> {
    throw new Error('PaymentService.verifyRazorpayPayment - Use Prisma implementation instead');
  }

  async processWalletPayment(orderId: string, amount: number): Promise<any> {
    throw new Error('PaymentService.processWalletPayment - Use Prisma implementation instead');
  }

  async getByOrder(orderId: string): Promise<any[]> {
    return [];
  }

  async getUserPayments(userId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    return [];
  }

  async findByOrderId(orderId: string): Promise<any> {
    return null;
  }

  async findById(id: string): Promise<any> {
    return null;
  }

  async updateStatus(id: string, status: PaymentStatus, metadata?: any): Promise<any> {
    return null;
  }
}
