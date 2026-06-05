import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Inject,
} from '@nestjs/common';
// import { PaymentService } from './payment.service'; // TODO: Use Prisma service from modules
import {
  InitiatePaymentDto,
  VerifyPaymentDto,
  PaymentResponseDto,
  PaymentMethod,
  PaymentStatus,
} from './payment.dto';
// import { OrderStatus } from '../orders/order.entity'; // TODO: Use Prisma types
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // TODO: Create or import proper auth guard
// import { OrderService } from '../orders/order.service'; // TODO: Use module service

/**
 * DEPRECATED: This controller is no longer used.
 * Use Prisma services from modules instead.
 */
@Controller('payments')
export class PaymentController {
  constructor() {
    // Stub - no dependencies
  }

  /**
   * Initiate payment (Razorpay or other gateway)
   */
  @Post('initiate')
  // @UseGuards(JwtAuthGuard)
  async initiate(@Req() req: any, @Body() initiatePaymentDto: InitiatePaymentDto) {
    throw new Error('PaymentController.initiate - Not implemented, use Prisma service');
  }

  @Post('verify')
  // @UseGuards(JwtAuthGuard)
  async verify(@Req() req: any, @Body() verifyPaymentDto: VerifyPaymentDto) {
    throw new Error('PaymentController.verify - Not implemented, use Prisma service');
  }

  @Get('order/:orderId')
  // @UseGuards(JwtAuthGuard)
  async getByOrder(@Param('orderId') orderId: string, @Req() req: any) {
    throw new Error('PaymentController.getByOrder - Not implemented, use Prisma service');
  }

  @Get(':id')
  // @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string) {
    throw new Error('PaymentController.getById - Not implemented, use Prisma service');
  }

  @Get('webhook/razorpay')
  async razorpayWebhook(@Body() payload: any) {
    throw new Error('PaymentController.razorpayWebhook - Not implemented, use Prisma service');
  }
}
